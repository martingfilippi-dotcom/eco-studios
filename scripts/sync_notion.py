#!/usr/bin/env python3
"""Sync only published, rights-verified ECO Studios records from Notion."""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TOKEN = os.environ.get("NOTION_TOKEN")
DATA_SOURCE_ID = os.environ.get("NOTION_DATA_SOURCE_ID")
OUTPUT = Path("data/eco-content.json")
NOTION_VERSION = "2025-09-03"

if not TOKEN:
    sys.exit("Missing NOTION_TOKEN. Add it in GitHub repository Actions secrets.")
if not DATA_SOURCE_ID:
    sys.exit("Missing NOTION_DATA_SOURCE_ID.")

def request_json(url, payload=None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="GET" if payload is None else "POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", "replace")
        sys.exit(f"Notion API error {exc.code}: {details[:1200]}")

def plain_text(value):
    if isinstance(value, list):
        return "".join(part.get("plain_text", "") for part in value).strip()
    return ""

def property_value(props, names):
    for name in names:
        prop = props.get(name)
        if not isinstance(prop, dict):
            continue
        kind = prop.get("type")
        if kind == "title":
            return plain_text(prop.get("title"))
        if kind == "rich_text":
            return plain_text(prop.get("rich_text"))
        if kind == "url":
            return prop.get("url")
        if kind == "checkbox":
            return bool(prop.get("checkbox"))
        if kind == "number":
            return prop.get("number")
        if kind == "select":
            selected = prop.get("select")
            return selected.get("name") if selected else None
        if kind == "status":
            selected = prop.get("status")
            return selected.get("name") if selected else None
        if kind == "files":
            files = prop.get("files") or []
            if files:
                first = files[0]
                return (first.get("external") or {}).get("url") or (first.get("file") or {}).get("url")
        if kind == "multi_select":
            return [x.get("name") for x in prop.get("multi_select", [])]
    return None

def get_text(props, *names):
    value = property_value(props, names)
    return value.strip() if isinstance(value, str) else value

def query_all():
    results = []
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = request_json(f"https://api.notion.com/v1/data_sources/{DATA_SOURCE_ID}/query", payload)
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            return results
        cursor = data.get("next_cursor")
        if not cursor:
            return results

def main():
    pages = query_all()
    items = []
    for page in pages:
        props = page.get("properties", {})
        name = get_text(props, "Nombre", "Name", "Título", "Title", "Artista")
        status = get_text(props, "Estado", "Status")
        rights = property_value(props, ("Derechos de uso verificados", "Permisos verificados", "Rights verified"))
        # Fail closed: never publish if the checkbox is absent or false.
        if not name or status != "Publicado" or rights is not True:
            continue

        order = property_value(props, ("Orden", "Order"))
        image_url = get_text(props, "Imagen URL", "Image URL")
        if not image_url:
            image_url = property_value(props, ("Imagen (archivo)", "Imagen", "Image"))
        description = get_text(props, "Biografía o descripción", "Descripción", "Description", "Biografía")
        external_url = get_text(props, "Enlace externo", "Web oficial", "Enlace", "URL")

        item = {
            "name": name,
            "type": get_text(props, "Tipo", "Type") or "Artista",
            "order": order if isinstance(order, (int, float)) else 999,
            "status": status,
            "imageUrl": image_url if isinstance(image_url, str) and image_url.startswith("https://") else None,
            "description": description or "",
            "externalUrl": external_url if isinstance(external_url, str) and external_url.startswith("https://") else None,
            "permissionVerified": True,
        }
        # Include supported public social/profile URLs when populated.
        social_fields = {
            "instagramUrl": ("Instagram", "Instagram URL"),
            "tiktokUrl": ("TikTok", "TikTok URL"),
            "spotifyUrl": ("Spotify", "Spotify URL"),
            "youtubeUrl": ("YouTube", "YouTube URL"),
            "appleMusicUrl": ("Apple Music", "Apple Music URL"),
            "deezerUrl": ("Deezer", "Deezer URL"),
            "bandcampUrl": ("Bandcamp", "Bandcamp URL"),
            "soundcloudUrl": ("SoundCloud", "SoundCloud URL"),
            "twitchUrl": ("Twitch", "Twitch URL"),
            "tidalUrl": ("TIDAL", "TIDAL URL"),
            "threadsUrl": ("Threads", "Threads URL"),
            "facebookUrl": ("Facebook", "Facebook URL"),
            "xUrl": ("X", "X URL"),
            "amazonMusicUrl": ("Amazon Music", "Amazon Music URL"),
        }
        for output_key, candidates in social_fields.items():
            value = get_text(props, *candidates)
            if isinstance(value, str) and value.startswith("https://"):
                item[output_key] = value
        items.append(item)

    items.sort(key=lambda item: (item["order"], item["name"].casefold()))
    # Preserve the file's top-level descriptive metadata, replacing only published items.
    existing = {}
    if OUTPUT.exists():
        try:
            existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            sys.exit("Existing data/eco-content.json is invalid JSON; refusing to overwrite.")
    output = {
        "schemaVersion": existing.get("schemaVersion", 1),
        "description": existing.get("description", "Datos editoriales públicos de ECO Studios."),
        "items": items,
        "lastSync": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(items)} published, rights-verified item(s) from {len(pages)} Notion page(s).")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Sync only published, rights-verified ECO Studios records from Notion."""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
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


YOUTUBE_ATOM_NS = "{http://www.w3.org/2005/Atom}"
YOUTUBE_NS = "{http://www.youtube.com/xml/schemas/2015}"
CHANNEL_ID_RE = re.compile(r"UC[A-Za-z0-9_-]{22}")


def fetch_public_text(url, timeout=12):
    """Read a small public YouTube response without needing credentials."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read(3_000_000).decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"YouTube lookup skipped for {url}: {exc}", file=sys.stderr)
        return None


def youtube_channel_id(channel_url):
    """Resolve a public channel URL/handle to its stable UC channel ID."""
    if not isinstance(channel_url, str) or not channel_url.startswith("https://"):
        return None
    try:
        parsed = urllib.parse.urlparse(channel_url)
    except ValueError:
        return None
    host = (parsed.hostname or "").lower()
    if host != "youtube.com" and not host.endswith(".youtube.com"):
        return None

    path_parts = [part for part in parsed.path.split("/") if part]
    if not path_parts:
        return None
    if path_parts[0] == "channel" and len(path_parts) > 1:
        match = CHANNEL_ID_RE.fullmatch(path_parts[1])
        return match.group(0) if match else None

    # The public handle page exposes the stable channel ID in its metadata.
    handle = path_parts[0]
    if not handle.startswith("@"):
        # Legacy /user/ URLs may still work with YouTube's RSS username route,
        # but do not guess an ID for /c/ URLs.
        return None
    page_html = fetch_public_text("https://www.youtube.com/" + urllib.parse.quote(handle, safe="@_-"))
    if not page_html:
        return None

    patterns = (
        r"""<meta[^>]*itemprop=["']channelId["'][^>]*content=["'](UC[A-Za-z0-9_-]{22})""",
        r"""<meta[^>]*content=["'](UC[A-Za-z0-9_-]{22})["'][^>]*itemprop=["']channelId["']""",
        r""""channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})""",
        r""""externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})""",
    )
    for pattern in patterns:
        match = re.search(pattern, page_html)
        if match:
            return match.group(1)
    print(f"Could not resolve YouTube channel ID for {channel_url}.", file=sys.stderr)
    return None


def youtube_recent_uploads(channel_url, limit=12):
    """Return recent public upload IDs/titles from the channel's official RSS feed."""
    channel_id = youtube_channel_id(channel_url)
    if not channel_id:
        return []
    feed_url = "https://www.youtube.com/feeds/videos.xml?channel_id=" + channel_id
    feed_xml = fetch_public_text(feed_url)
    if not feed_xml:
        return []
    try:
        root = ET.fromstring(feed_xml)
    except ET.ParseError as exc:
        print(f"Could not parse YouTube RSS for {channel_url}: {exc}", file=sys.stderr)
        return []

    videos = []
    seen = set()
    for entry in root.findall(f"{YOUTUBE_ATOM_NS}entry"):
        video_id = (entry.findtext(f"{YOUTUBE_NS}videoId") or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id) or video_id in seen:
            continue
        title = (entry.findtext(f"{YOUTUBE_ATOM_NS}title") or "").strip()
        published = (entry.findtext(f"{YOUTUBE_ATOM_NS}published") or "").strip()
        videos.append({"id": video_id, "title": title, "published": published})
        seen.add(video_id)
        if len(videos) >= limit:
            break
    return videos

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
            "instagramUrl": ("Instagram URL",),
            "tiktokUrl": ("TikTok URL",),
            "spotifyUrl": ("Spotify URL",),
            "youtubeUrl": ("YouTube URL",),
            "appleMusicUrl": ("Apple Music URL",),
            "deezerUrl": ("Deezer URL",),
            "bandcampUrl": ("Bandcamp URL",),
            "soundcloudUrl": ("SoundCloud URL",),
            "twitchUrl": ("Twitch URL",),
            "tidalUrl": ("TIDAL URL",),
            "threadsUrl": ("Threads URL",),
            "facebookUrl": ("Facebook URL",),
            "xUrl": ("X URL",),
            "amazonMusicUrl": ("Amazon Music URL",),
            "websiteUrl": ("Web oficial URL",),
        }
        for output_key, candidates in social_fields.items():
            value = get_text(props, *candidates)
            if isinstance(value, str):
                value = value.strip()
            if isinstance(value, str) and value.startswith("https://"):
                item[output_key] = value

        # Resolve channel uploads only for published, rights-verified artists. This
        # is best-effort: a YouTube lookup failure must not block editorial sync.
        if str(item.get("type") or "").strip().casefold() == "artista":
            youtube_url = item.get("youtubeUrl")
            if youtube_url:
                videos = youtube_recent_uploads(youtube_url)
                if videos:
                    item["youtubeVideos"] = videos
                    print(f"Found {len(videos)} recent YouTube video(s) for {name}.")
                else:
                    print(f"No embeddable upload list found for {name}; keeping channel link.")
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

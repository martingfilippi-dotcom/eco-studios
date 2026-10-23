#!/usr/bin/env python3
"""Write actual successful GitHub sync results back to ECO Studios in Notion."""
from __future__ import annotations
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

TOKEN = os.environ.get("NOTION_TOKEN")
DATA_SOURCE_ID = os.environ.get("NOTION_DATA_SOURCE_ID")
NOTION_VERSION = "2025-09-03"
if not TOKEN or not DATA_SOURCE_ID:
    sys.exit("Missing NOTION_TOKEN or NOTION_DATA_SOURCE_ID.")

def request_json(url: str, payload: dict | None = None) -> dict:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    for attempt in range(5):
        req = urllib.request.Request(url, data=body, method="GET" if payload is None else "POST", headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", "replace")
            if exc.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(max(1.0, float(exc.headers.get("Retry-After", 1 + attempt))))
                continue
            raise RuntimeError(f"Notion API error {exc.code}: {details[:800]}") from exc
    raise RuntimeError("Notion API retry limit reached.")

def plain_text(parts: list[dict]) -> str:
    return "".join(part.get("plain_text") or (part.get("text") or {}).get("content", "") for part in (parts or [])).strip()

def read_property(props: dict, key: str):
    prop = props.get(key) or {}
    kind = prop.get("type")
    if kind == "title":
        return plain_text(prop.get("title") or [])
    if kind == "rich_text":
        return plain_text(prop.get("rich_text") or [])
    if kind == "status":
        selected = prop.get("status")
        return selected.get("name") if selected else None
    if kind == "checkbox":
        return prop.get("checkbox") is True
    if kind == "date":
        selected = prop.get("date")
        return selected.get("start") if selected else None
    return None

def query_all() -> list[dict]:
    pages = []
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        result = request_json(f"https://api.notion.com/v1/data_sources/{DATA_SOURCE_ID}/query", payload)
        pages.extend(result.get("results", []))
        if not result.get("has_more"):
            return pages
        cursor = result.get("next_cursor")
        if not cursor:
            return pages

def main() -> int:
    pages = query_all()
    synced = excluded = unchanged = 0
    failures = []
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    for page in pages:
        page_id = page.get("id")
        props = page.get("properties") or {}
        name = read_property(props, "Nombre")
        if not page_id or not name:
            continue
        status = read_property(props, "Estado")
        rights = read_property(props, "Derechos de uso verificados") is True
        publishable = status == "Publicado" and rights
        if publishable:
            result_text = "Sincronizado con GitHub; comprobar el despliegue de Pages."
        elif name.strip().casefold() == "prueba de sincronización eco":
            result_text = "Prueba técnica conservada como borrador; excluida de producción."
        elif status != "Publicado":
            result_text = f"No publicado: Estado = {status or 'sin definir'}."
        else:
            result_text = "No publicado: derechos de uso sin verificar."
        updates = {}
        if (read_property(props, "Último resultado") or "") != result_text:
            updates["Último resultado"] = {"rich_text": [{"type": "text", "text": {"content": result_text}}]}
        # This timestamp records inclusion in the JSON sync, not an independently verified browser test.
        if publishable:
            updates["Última sincronización"] = {"date": {"start": now}}
        if not updates:
            unchanged += 1
            continue
        try:
            time.sleep(0.35)
            request_json(f"https://api.notion.com/v1/pages/{page_id}", {"properties": updates})
            if publishable:
                synced += 1
            else:
                excluded += 1
        except Exception as exc:
            failures.append(f"{name}: {exc}")
    print(f"Notion status writeback: {synced} included record(s) timestamped, {excluded} excluded result(s) refreshed, {unchanged} unchanged.")
    if failures:
        for error in failures:
            print(f"::error::{error}", file=sys.stderr)
        return 1
    print("Only sync status fields were updated; editorial state and rights were not changed.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

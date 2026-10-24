#!/usr/bin/env python3
"""Mirror LK's approved public SoundCloud oEmbed thumbnail into ECO Studios assets.

The Notion image field remains editorially blank; this file is a derived fallback
from LK's official SoundCloud link, used only when no editorial image is supplied.
"""
from __future__ import annotations

import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

SOUNDCLOUD_URL = "https://on.soundcloud.com/syICozVXOKxCjTPpwj"
ASSET_DIR = Path("assets")
MAX_BYTES = 5_000_000
USER_AGENT = "ECO-Studios-SoundCloud-Mirror/1.0"


def safe_soundcloud_thumbnail(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not (host == "sndcdn.com" or host.endswith(".sndcdn.com")):
        raise ValueError("SoundCloud returned an unexpected thumbnail host or protocol")
    return url


def read_response(url: str, accept: str, timeout: int = 25) -> tuple[bytes, str, str]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": accept, "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        final_url = response.geturl()
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("SoundCloud thumbnail exceeds the 5 MB safety limit")
    return data, content_type, final_url


def choose_extension(data: bytes, content_type: str) -> str:
    if content_type in ("image/jpeg", "image/jpg") and data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if content_type == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if content_type == "image/webp" and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    raise ValueError("SoundCloud thumbnail was not a recognized JPEG, PNG, or WebP image")


def main() -> int:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    old_assets = [
        ASSET_DIR / "lk-soundcloud-thumbnail.jpg",
        ASSET_DIR / "lk-soundcloud-thumbnail.png",
        ASSET_DIR / "lk-soundcloud-thumbnail.webp",
    ]
    try:
        oembed_url = "https://soundcloud.com/oembed?format=json&url=" + urllib.parse.quote(SOUNDCLOUD_URL, safe="")
        raw_json, content_type, final_json_url = read_response(oembed_url, "application/json")
        if not content_type.startswith("application/json") and "json" not in content_type:
            raise ValueError("SoundCloud oEmbed did not return JSON")
        payload = json.loads(raw_json.decode("utf-8"))
        thumbnail_url = safe_soundcloud_thumbnail(str(payload.get("thumbnail_url") or ""))
        image_bytes, image_type, final_image_url = read_response(thumbnail_url, "image/*")
        safe_soundcloud_thumbnail(final_image_url)
        if not image_type.startswith("image/") or len(image_bytes) < 10_000:
            raise ValueError(f"Unexpected image response type/size: {image_type!r}, {len(image_bytes)} bytes")
        extension = choose_extension(image_bytes, image_type)
        target = ASSET_DIR / ("lk-soundcloud-thumbnail" + extension)
        existing = target.read_bytes() if target.is_file() else None
        if existing != image_bytes:
            temporary = target.with_suffix(target.suffix + ".tmp")
            temporary.write_bytes(image_bytes)
            temporary.replace(target)
            print(f"Cached LK SoundCloud thumbnail: {target} ({len(image_bytes)} bytes, {image_type}).")
        else:
            print(f"LK SoundCloud thumbnail unchanged: {target}.")
        for old in old_assets:
            if old != target and old.exists():
                old.unlink()
    except Exception as exc:
        if any(path.is_file() and path.stat().st_size >= 10_000 for path in old_assets):
            print(f"::warning::SoundCloud refresh failed; preserving the last verified LK thumbnail: {exc}")
            return 0
        print(f"::warning::No verified LK SoundCloud thumbnail available in this run: {exc}")
        # Preserve the live website's browser-side SoundCloud fallback if no cache exists.
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())

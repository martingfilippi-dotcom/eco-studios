#!/usr/bin/env python3
"""Export the latest published ECO Studios editor record as safe public settings."""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

TOKEN = os.environ.get("NOTION_TOKEN")
DATA_SOURCE_ID = os.environ.get("NOTION_CONFIG_DATA_SOURCE_ID", "860acdc0-7ed3-4e05-86f3-d028788bb43e")
OUTPUT = Path("data/eco-site-config.json")
VERSION = "2025-09-03"
SITE_HOST = "martingfilippi-dotcom.github.io"
PUBLIC_LINK_HOSTS = {
    SITE_HOST, "music.apple.com", "www.youtube.com", "youtube.com", "youtu.be",
    "soundcloud.com", "www.soundcloud.com", "instagram.com", "www.instagram.com",
    "wa.me", "open.spotify.com", "spotify.com", "www.tiktok.com", "tiktok.com",
}
if not TOKEN:
    sys.exit("Missing NOTION_TOKEN; refusing to overwrite public site configuration.")

def request_json(url, payload=None):
    request = urllib.request.Request(
        url,
        data=None if payload is None else json.dumps(payload).encode("utf-8"),
        method="GET" if payload is None else "POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", "replace")
        sys.exit(f"Notion config API error {exc.code}: {details[:700]}")

def text(parts):
    return "".join(item.get("plain_text", "") for item in (parts or [])).strip()

def value(prop):
    if not isinstance(prop, dict):
        return None
    kind = prop.get("type")
    if kind == "title":
        return text(prop.get("title"))
    if kind == "rich_text":
        return text(prop.get("rich_text"))
    if kind == "select":
        return (prop.get("select") or {}).get("name")
    if kind == "status":
        return (prop.get("status") or {}).get("name")
    if kind == "checkbox":
        return prop.get("checkbox") is True
    if kind == "url":
        return prop.get("url")
    if kind == "email":
        return prop.get("email")
    if kind == "phone_number":
        return prop.get("phone_number")
    return None

def safe_color(value, default):
    if not isinstance(value, str):
        return default
    candidate = value.strip()
    if re.fullmatch(r"#[0-9a-fA-F]{3,8}", candidate):
        return candidate
    if re.fullmatch(r"rgba?\(\s*[0-9.,%\s]+\)", candidate):
        return candidate
    return default

def safe_url(value, default=""):
    """Public static assets and community return must remain on our trusted GitHub Pages host."""
    if not isinstance(value, str) or len(value) >= 1000:
        return default
    try:
        parsed = urlsplit(value.strip())
        port = parsed.port
    except ValueError:
        return default
    if (
        parsed.scheme != "https" or parsed.hostname != SITE_HOST
        or parsed.username or parsed.password or port not in (None, 443)
    ):
        return default
    return value.strip()

def safe_link(value, default=""):
    """Only allow anchors or explicit HTTPS destinations on an approved public domain."""
    if not isinstance(value, str) or len(value) >= 1000:
        return default
    candidate = value.strip()
    if re.fullmatch(r"#[A-Za-z][A-Za-z0-9_-]*", candidate):
        return candidate
    try:
        parsed = urlsplit(candidate)
        port = parsed.port
    except ValueError:
        return default
    host = (parsed.hostname or "").lower()
    if (
        parsed.scheme != "https" or host not in PUBLIC_LINK_HOSTS
        or parsed.username or parsed.password or port not in (None, 443)
    ):
        return default
    return candidate

def safe_text(value, default="", limit=500):
    if not isinstance(value, str):
        return default
    candidate = value.strip()
    return candidate[:limit] if candidate else default

def safe_email(value, default):
    if not isinstance(value, str):
        return default
    candidate = value.strip()
    pattern = r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
    return candidate if re.fullmatch(pattern, candidate) else default

def safe_phone(value, default):
    if not isinstance(value, str):
        return default
    digits = re.sub(r"\D", "", value)
    return digits if 8 <= len(digits) <= 15 else default

def show(value):
    # Empty properties should preserve today's design until an owner explicitly hides a section.
    return value is not False

def main():
    pages, cursor = [], None
    while True:
        payload = {"page_size": 100, "sorts": [{"timestamp": "last_edited_time", "direction": "descending"}]}
        if cursor:
            payload["start_cursor"] = cursor
        result = request_json(f"https://api.notion.com/v1/data_sources/{DATA_SOURCE_ID}/query", payload)
        pages.extend(result.get("results", []))
        if not result.get("has_more"):
            break
        cursor = result.get("next_cursor")
        if not cursor:
            break

    candidates = []
    for page in pages:
        props = page.get("properties", {})
        if value(props.get("Estado")) != "Publicado":
            continue
        candidates.append((page.get("last_edited_time", ""), {name: value(prop) for name, prop in props.items()}))
    if not candidates:
        sys.exit("No published ECO site configuration found; refusing to replace existing config.")
    edited_at, p = max(candidates, key=lambda item: item[0])

    config = {
        "schemaVersion": 1,
        "source": "notion",
        "lastSync": edited_at or None,
        "colors": {
            "bg": safe_color(p.get("Color de fondo"), "#10100f"),
            "panel": safe_color(p.get("Color de panel"), "#191917"),
            "panel2": safe_color(p.get("Color de panel secundario"), "#20201d"),
            "text": safe_color(p.get("Color de texto"), "#f5f3ed"),
            "muted": safe_color(p.get("Color de texto secundario"), "#a8a69e"),
            "line": safe_color(p.get("Color de borde"), "rgba(245,243,237,.15)"),
            "orange": safe_color(p.get("Color de acento"), "#ff6a2b"),
            "orange2": safe_color(p.get("Color de acento secundario"), "#ff8b50"),
        },
        "fonts": {
            "body": p.get("Fuente de cuerpo") if p.get("Fuente de cuerpo") in {"DM Sans", "Inter", "Manrope", "Space Grotesk"} else "DM Sans",
            "heading": p.get("Fuente de títulos") if p.get("Fuente de títulos") in {"DM Sans", "Inter", "Manrope", "Space Grotesk"} else "Space Grotesk",
        },
        "brand": {
            "name": safe_text(p.get("Nombre de marca"), "ECO", 60),
            "subtitle": safe_text(p.get("Subtítulo de marca"), "STUDIOS", 80),
            "mark": safe_text(p.get("Letra del logo"), "E", 4),
            "seoDescription": safe_text(p.get("Descripción SEO"), "ECO Studios — música, artistas y producción audiovisual desde Paraguay.", 300),
        },
        "hero": {
            "eyebrow": safe_text(p.get("Texto miniatura hero"), "PLATAFORMA CREATIVA · ASUNCIÓN, PARAGUAY", 180),
            "titleLine1": safe_text(p.get("Título hero primera línea"), "Una voz.", 180),
            "titleLine2": safe_text(p.get("Título hero segunda línea"), "Muchos ecos.", 180),
            "description": safe_text(p.get("Descripción hero"), "Música, imágenes y comunidad. ECO conecta artistas que comparten una misma energía, sin perder lo que hace único a cada uno.", 600),
            "primaryLabel": safe_text(p.get("Botón hero principal"), "Conocé el colectivo", 100),
            "primaryUrl": safe_link(p.get("Enlace hero principal"), "#artistas"),
            "secondaryLabel": safe_text(p.get("Botón hero secundario"), "Escuchar música", 100),
            "secondaryUrl": safe_link(p.get("Enlace hero secundario"), "#musica"),
            "imageUrl": safe_url(p.get("Imagen hero URL"), ""),
        },
        "visibility": {
            "history": show(p.get("Mostrar sección historia")),
            "artists": show(p.get("Mostrar sección artistas")),
            "music": show(p.get("Mostrar sección música")),
            "audiovisual": show(p.get("Mostrar sección audiovisual")),
            "news": show(p.get("Mostrar sección novedades")),
            "team": show(p.get("Mostrar sección equipo")),
            "contact": show(p.get("Mostrar sección contacto")),
        },
        "history": {
            "eyebrow": safe_text(p.get("Historia · etiqueta"), "EL PROYECTO", 100),
            "kicker": safe_text(p.get("Historia · microetiqueta"), "DE UNA IDEA A UN MOVIMIENTO", 120),
            "titleLine1": safe_text(p.get("Historia · título primera línea"), "El arte nos conecta.", 180),
            "titleLine2": safe_text(p.get("Historia · título segunda línea"), "El eco nos reúne.", 180),
            "body1": safe_text(p.get("Historia · texto principal"), "ECO Studios es una plataforma creativa que conecta artistas, música, producción y cultura audiovisual.", 700),
            "body2": safe_text(p.get("Historia · texto secundario"), "Nació de la amistad, de hacer cosas juntos y de la convicción de que cada artista puede tener su propio sonido dentro de una identidad compartida. No se trata de sonar igual: se trata de crear en comunidad y hacer que cada obra llegue más lejos.", 900),
            "origin": safe_text(p.get("Historia · texto de origen"), "La idea del nombre ECO, según la historia compartida por el equipo, apareció en un sueño de Ascarza. Una imagen sencilla para algo que sigue creciendo: lo que creamos resuena en los demás.", 700),
            "teamLink": safe_text(p.get("Historia · enlace de equipo"), "Conocé al equipo", 100),
            "values": [
                safe_text(p.get("Historia · valor 1"), "MÚSICA ORIGINAL", 80),
                safe_text(p.get("Historia · valor 2"), "IDENTIDAD PROPIA", 80),
                safe_text(p.get("Historia · valor 3"), "CREACIÓN COLECTIVA", 80),
                safe_text(p.get("Historia · valor 4"), "VISIÓN AUDIOVISUAL", 80),
            ],
        },
        "artists": {
            "eyebrow": safe_text(p.get("Artistas · etiqueta"), "EL ROSTER", 100),
            "kicker": safe_text(p.get("Artistas · microetiqueta"), "ARTISTAS DEL COLECTIVO", 120),
            "titleLine1": safe_text(p.get("Artistas · título primera línea"), "Distintas voces.", 180),
            "titleLine2": safe_text(p.get("Artistas · título segunda línea"), "Un mismo eco.", 180),
            "description": safe_text(p.get("Artistas · descripción"), "Descubrí a las personas que forman parte de la escena ECO. Los enlaces de escucha llevan a páginas musicales verificadas o a lanzamientos colectivos donde participan.", 650),
            "directoryLabel": safe_text(p.get("Artistas · enlace directorio"), "Explorar todos los perfiles ↗", 120),
        },
        "music": {
            "eyebrow": safe_text(p.get("Música · etiqueta"), "CATÁLOGO", 100),
            "kicker": safe_text(p.get("Música · microetiqueta"), "LANZAMIENTOS Y SESIONES", 120),
            "titleLine1": safe_text(p.get("Música · título primera línea"), "La música habla", 180),
            "titleLine2": safe_text(p.get("Música · título segunda línea"), "por nosotros.", 180),
            "description": safe_text(p.get("Música · descripción"), "Un punto de partida para descubrir el sonido de ECO. Cada botón abre una página de música real en Apple Music.", 650),
            "note": safe_text(p.get("Música · nota del catálogo"), "El catálogo también conserva colaboraciones históricas del colectivo, con artistas que compartieron escenario en distintas sesiones en vivo.", 600),
            "noteUrl": safe_link(p.get("Música · enlace de la nota"), "https://music.apple.com/us/album/eco-live-at-black-mango-live/1822286569"),
        },
        "audiovisual": {
            "eyebrow": safe_text(p.get("Audiovisual · etiqueta"), "IMAGEN Y MOVIMIENTO", 100),
            "kicker": safe_text(p.get("Audiovisual · microetiqueta"), "OV AUDIOVISUAL · PRODUCCIÓN CREATIVA", 120),
            "topline": safe_text(p.get("Audiovisual · texto superior"), "DIRECCIÓN VISUAL · FOTO · VIDEO", 160),
            "titleLine1": safe_text(p.get("Audiovisual · título primera línea"), "Tu música merece", 180),
            "titleLine2": safe_text(p.get("Audiovisual · título segunda línea"), "una imagen propia.", 180),
            "lead": safe_text(p.get("Audiovisual · texto principal"), "Imágenes que transmiten una identidad. Videos que cuentan una historia. Una estética pensada para que cada artista se vea y se recuerde.", 700),
            "description": safe_text(p.get("Audiovisual · texto secundario"), "Gastón OV desarrolla proyectos audiovisuales para artistas y marcas: desde la idea y la fotografía hasta piezas de video que acompañan lanzamientos, campañas y contenido para redes.", 900),
            "buttonLabel": safe_text(p.get("Audiovisual · texto del botón"), "Consultar un proyecto por WhatsApp ↗", 150),
            "buttonUrl": safe_link(p.get("Audiovisual · URL del botón"), "https://wa.me/595972861717?text=Hola%20OV%20Audiovisual%2C%20quiero%20consultar%20por%20un%20proyecto."),
            "instagramLabel": safe_text(p.get("Audiovisual · texto de Instagram"), "Ver trabajos en Instagram ↗", 120),
            "instagramUrl": safe_link(p.get("Audiovisual · URL de Instagram"), "https://www.instagram.com/ov.audiovisual/"),
            "image1Url": safe_url(p.get("Audiovisual · imagen 1 URL"), ""),
            "image2Url": safe_url(p.get("Audiovisual · imagen 2 URL"), ""),
        },
        "news": {
            "eyebrow": safe_text(p.get("Novedades · etiqueta"), "CONTENIDO DEL ESTUDIO", 100),
            "kicker": safe_text(p.get("Novedades · microetiqueta"), "ACTUALIZACIONES APROBADAS", 120),
            "titleLine1": safe_text(p.get("Novedades · título primera línea"), "Lo nuevo en", 180),
            "titleLine2": safe_text(p.get("Novedades · título segunda línea"), "ECO Studios.", 180),
            "description": safe_text(p.get("Novedades · descripción"), "Artistas, lanzamientos, noticias y proyectos publicados por el equipo de ECO Studios.", 650),
        },
        "team": {
            "eyebrow": safe_text(p.get("Equipo · etiqueta"), "EL EQUIPO", 100),
            "kicker": safe_text(p.get("Equipo · microetiqueta"), "DETRÁS DE LA IDEA", 120),
            "titleLine1": safe_text(p.get("Equipo · título primera línea"), "Un colectivo", 180),
            "titleLine2": safe_text(p.get("Equipo · título segunda línea"), "se construye juntos.", 180),
            "description": safe_text(p.get("Equipo · descripción"), "ECO crece gracias a artistas, productores y personas que aportan su oficio, su tiempo y su visión.", 650),
        },
        "contact": {
            "eyebrow": safe_text(p.get("Contacto · etiqueta"), "CONTACTO", 100),
            "kicker": safe_text(p.get("Contacto · microetiqueta"), "CANALES OFICIALES · ECO STUDIOS", 120),
            "email": safe_email(p.get("Contacto · correo oficial"), "ecostudiosparaguay@gmail.com"),
            "whatsappLabel": safe_text(p.get("Contacto · etiqueta WhatsApp"), "WHATSAPP OFICIAL", 100),
            "phone": safe_phone(p.get("Contacto · teléfono WhatsApp"), "595994562633"),
        },
        "footer": {
            "tagline": safe_text(p.get("Footer · lema"), "Independiente por naturaleza.", 200),
            "copyright": safe_text(p.get("Footer · copyright"), "© ECO STUDIOS · ASUNCIÓN, PARAGUAY", 200),
            "backTop": safe_text(p.get("Footer · enlace arriba"), "VOLVER ARRIBA ↑", 100),
        },
        "navigation": {
            "project": {"label": safe_text(p.get("Etiqueta menú proyecto"), "El proyecto", 80), "visible": p.get("Mostrar menú proyecto") is not False, "href": "#historia"},
            "artists": {"label": safe_text(p.get("Etiqueta menú artistas"), "Artistas", 80), "visible": p.get("Mostrar menú artistas") is not False, "href": "#artistas"},
            "music": {"label": safe_text(p.get("Etiqueta menú música"), "Música", 80), "visible": p.get("Mostrar menú música") is not False, "href": "#musica"},
            "audiovisual": {"label": safe_text(p.get("Etiqueta menú audiovisual"), "Audiovisual", 80), "visible": p.get("Mostrar menú audiovisual") is not False, "href": "#audiovisual"},
            "contact": {"label": safe_text(p.get("Etiqueta menú contacto"), "Contacto ↗", 80), "visible": p.get("Mostrar menú contacto") is not False, "href": "#contacto"},
            "mobileLabel": safe_text(p.get("Etiqueta botón menú móvil"), "Menú", 40),
        },
        "communityReturn": {
            "visible": p.get("Mostrar enlace retorno comunidad") is not False,
            "label": safe_text(p.get("Etiqueta retorno comunidad"), "VOLVER A COMUNIDAD DE ARTISTAS PARAGUAYOS", 160),
            "url": safe_url(p.get("URL retorno comunidad"), "https://martingfilippi-dotcom.github.io/comunidad-artistas-paraguayos./"),
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported the latest published visual configuration to {OUTPUT}.")

if __name__ == "__main__":
    main()

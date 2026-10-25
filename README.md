# ECO Studios

Sitio independiente de ECO Studios: música, artistas, lanzamientos, eventos y producción audiovisual.

- **Web pública:** https://martingfilippi-dotcom.github.io/eco-studios/
- **Contenido público consumido por la web:** [data/eco-content.json](data/eco-content.json)

## Arquitectura

La web estática se despliega con GitHub Pages. Notion es la fuente operativa de los registros editoriales aprobados; GitHub Actions consulta la base compartida, aplica el filtro estricto `Estado = Publicado` y derechos verificados, y publica `data/eco-content.json`. El flujo corre cada cinco minutos y también se puede ejecutar manualmente. Guardar `NOTION_TOKEN` únicamente en los secretos del repositorio de GitHub Actions. No reintroducir servicios antiguos de automatización salvo que se rediseñen y aprueben expresamente.

Este repositorio no debe sincronizarse con la web ni con la base editorial de Comunidad de Artistas Paraguayos. Son proyectos separados con repositorios y flujos independientes.

## Formato del contenido editorial

El archivo `data/eco-content.json` contiene un objeto con `schemaVersion`, `description`, `items` y `lastSync`. La configuración visual global se publica por separado en `data/eco-site-config.json`. Cada elemento puede contener:

- `name`: nombre público
- `type`: tipo de contenido
- `description`: descripción pública revisada
- `imageUrl`: URL HTTPS pública de una imagen, opcional
- `externalUrl`: URL HTTPS pública, opcional
- `status`: solo `Publicado` puede mostrarse
- `permissionVerified`: debe ser `true` cuando el contenido requiere autorización
- `order`: orden numérico

La web muestra únicamente elementos con nombre, estado `Publicado` y `permissionVerified: true`. Los datos públicos no deben incluir identificadores internos de Notion, notas editoriales privadas, credenciales ni tokens.

## Seguridad y mantenimiento

- Guardar `NOTION_TOKEN` únicamente en GitHub Actions repository secrets; nunca en este repositorio, en Notion público ni en chats.
- La integración de Notion debe tener acceso compartido explícito a `📦 Contenido de ECO Studios` y `⚙️ Editor visual de ECO Studios`. La falta de acceso a la base visual conserva la última configuración segura, pero impide que los cambios visuales de Notion lleguen a la web.
- El workflow está programado cada cinco minutos y verifica el JSON editorial público; la revisión del editor visual debe confirmar también que `data/eco-site-config.json` coincide con el registro `Publicado` de Notion.
- No publicar borradores ni contenido sin derechos verificados.
- Validar el JSON y comprobar la web pública tras cambios editoriales.
- No eliminar repositorios históricos o recursos hasta confirmar sus dependencias externas.
- Mantener la documentación operativa y los enlaces internos del espacio de trabajo en un espacio privado, no en este README público.

## Configuración visual administrada en Notion

- Fuente: base **⚙️ Editor visual de ECO Studios** en Notion.
- Código cliente: `site-config.js`, que aplica la configuración publicada al cargar la página principal.
- Exportador: `scripts/sync_site_config.py`, que solo lee registros cuyo estado sea `Publicado`, valida colores, tipografías y URL, y emite el archivo público `data/eco-site-config.json`.
- Seguridad: los valores exportados son públicos. No introducir información privada, secretos, tokens, notas internas ni datos de acceso. El exportador conserva valores predeterminados seguros cuando un campo es inválido.
- Limitación vigente: la sincronización de la base visual depende de que la integración de GitHub Actions tenga acceso directo a esa base. Si no está compartida, se mantiene el último JSON válido y se informa el bloqueo; no se da por confirmada la sincronización visual.

## Despliegue

El sitio se publica con GitHub Pages mediante GitHub Actions. Para investigar fallos, revisar la pestaña **Actions** y la configuración de Pages en GitHub.

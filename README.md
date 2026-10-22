# ECO Studios

Sitio independiente de ECO Studios: música, artistas, lanzamientos, eventos y producción audiovisual.

- **Web pública:** https://martingfilippi-dotcom.github.io/eco-studios/
- **Contenido público consumido por la web:** [data/eco-content.json](data/eco-content.json)

## Arquitectura

La web estática se despliega con GitHub Pages. El contenido editorial público se prepara en Notion, se sincroniza mediante un escenario de Make dedicado a ECO Studios y se guarda en `data/eco-content.json`.

Este repositorio no debe sincronizarse con la web ni con la base editorial de Comunidad de Artistas Paraguayos. Son proyectos separados con repositorios y flujos independientes.

## Formato del contenido editorial

El archivo JSON contiene un objeto con `schemaVersion`, `description`, `items` y `lastSync`. Cada elemento puede contener:

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

- Guardar las credenciales únicamente en conexiones seguras del proveedor de automatización; nunca en este repositorio.
- No publicar borradores ni contenido sin derechos verificados.
- Validar el JSON y comprobar la web pública tras cambios editoriales.
- No eliminar repositorios históricos o recursos hasta confirmar sus dependencias externas.
- Mantener la documentación operativa y los enlaces internos del espacio de trabajo en un espacio privado, no en este README público.

## Despliegue

El sitio se publica con GitHub Pages mediante GitHub Actions. Para investigar fallos, revisar la pestaña **Actions** y la configuración de Pages en GitHub.

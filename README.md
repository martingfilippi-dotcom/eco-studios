# ECO Studios

Sitio independiente de ECO Studios: música, identidad creativa y producción audiovisual.

## Accesos oficiales

- **Web pública:** https://martingfilippi-dotcom.github.io/eco-studios/
- **Panel editorial de Ascarza:** https://app.notion.com/p/3fe76919699081beb77cc3658f1edc29
- **Base editorial en Notion:** https://app.notion.com/p/c7ef2fdcfdb9439d96da9ded39d42b5a
- **Guía operativa de Make (fuente vigente):** https://app.notion.com/p/3fe769196990818f96a7d69c59373634
- **Datos consumidos por la web:** [data/eco-content.json](data/eco-content.json)

## Límites entre proyectos

Este repositorio es exclusivo de **ECO Studios**. No sincronizar desde ni hacia el repositorio de **Comunidad de Artistas Paraguayos**. Los dos sitios se despliegan por separado. Los recursos visuales usados por esta web se sirven desde este mismo repositorio. `eco-music-web` se conserva como respaldo histórico, pero el HTML actual ya no depende de sus imágenes.

## Arquitectura editorial

```text
Notion — 📦 Contenido de ECO Studios
             |
             | Make (configuración y prueba pendientes)
             v
GitHub — data/eco-content.json
             |
             v
Web pública — GitHub Pages
```

La web muestra elementos de `items` con `status: "Publicado"` y un `name` válido. El orden se controla con `order`. Las fichas no se publican por el mero hecho de existir en Notion.

## Esquema de contenido

Cada elemento puede incluir:

- `name`: nombre público
- `type`: Artista, Lanzamiento, Noticia, Evento, Producción audiovisual o Equipo
- `description`: descripción revisada
- `imageUrl`: URL HTTPS válida, opcional
- `externalUrl`: URL HTTPS válida, opcional
- `status`: debe ser `Publicado` para mostrarse
- `permissionVerified`: booleano; debe ser `true` para mostrarse, y solo se mapea cuando «Derechos de uso verificados» está marcado en Notion
- `order`: orden numérico

Antes de publicar, verificar permisos y derechos de uso. Nunca cambiar automáticamente un borrador a publicado para probar la automatización.

## Estado verificado — 20 de octubre de 2026

- El repositorio y la ruta del JSON están identificados.
- `data/eco-content.json` mantiene `items: []` y `lastSync: null`.
- No hay fichas editoriales publicadas en la base consultada; por eso el resultado vacío es esperado.
- La automatización Notion → Make → GitHub no se considera activa ni validada de extremo a extremo.
- El escenario de Make debe apuntar únicamente a este repositorio y leer el SHA actual antes de actualizar el archivo.
- No se hicieron cambios a la web pública ni se publicó contenido editorial durante esta auditoría.

## Publicación del sitio

Este repositorio utiliza GitHub Actions para desplegar el contenido estático de la raíz. En GitHub, comprobar **Settings → Pages → Source: GitHub Actions** si el despliegue deja de funcionar.

## Mantenimiento

1. Editar y revisar el contenido en Notion.
2. Marcar `Publicado` solo cuando esté aprobado y tenga derechos de uso verificados.
3. Probar la sincronización en Make antes de activar ejecuciones recurrentes.
4. Validar el JSON y comprobar la web tras un cambio.
5. No borrar repositorios o recursos antiguos hasta confirmar que no quedan referencias activas.

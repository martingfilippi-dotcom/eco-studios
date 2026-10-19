# ECO Studios

Sitio independiente de ECO Studios: música, identidad creativa y producción audiovisual.

## Sitios y administración

- **Web pública:** https://martingfilippi-dotcom.github.io/eco-studios/
- **Panel editorial de Ascarza:** https://app.notion.com/p/3fe76919699081beb77cc3658f1edc29
- **Base de contenido en Notion:** https://app.notion.com/p/c7ef2fdcfdb9439d96da9ded39d42b5a
- **Archivo editorial consumido por la web:** [data/eco-content.json](data/eco-content.json)
- **Guía de automatización prevista:** https://app.notion.com/p/3fe769196990818f96a7d69c59373634

## Cómo funciona el contenido administrado

La página principal lee `data/eco-content.json`. Solo muestra los elementos que tengan `status: "Publicado"`, un `name` válido y los campos opcionales correspondientes. Los elementos se ordenan por `order`.

Formato de cada elemento:

```json
{
  "name": "Nombre público",
  "type": "Artista",
  "description": "Descripción pública y revisada.",
  "imageUrl": "https://example.com/imagen.jpg",
  "externalUrl": "https://example.com/recurso",
  "status": "Publicado",
  "order": 10
}
```

El archivo actual puede tener `items: []`, por lo que no se mostrarán tarjetas editoriales adicionales hasta que se agreguen elementos válidos.

## Estado de la automatización

**Notion → Make → GitHub todavía no está conectado ni probado de extremo a extremo.** Crear o editar una ficha en Notion no actualiza automáticamente este JSON por ahora. No se debe presentar la automatización como activa hasta que se configure Make, se limite su acceso a este repositorio y se verifique una prueba real.

Cuando se active, el escenario deberá:
1. Detectar nuevas fichas y cambios en Notion.
2. Validar el contenido y los derechos de uso antes de publicar.
3. Transformar los campos de Notion al formato JSON que consume la web.
4. Actualizar este archivo sin duplicar registros ni sobrescribir el diseño.
5. Confirmar el resultado en Notion y registrar errores de sincronización.

## Publicación de la web

Este repositorio usa GitHub Actions para publicar el contenido estático de la raíz en GitHub Pages. En **Settings → Pages**, la fuente debe ser **GitHub Actions**.

## Recursos visuales

Algunos recursos iniciales se cargan desde el repositorio público existente `eco-music-web`. Para hacer el sitio completamente independiente, se pueden copiar los recursos necesarios a este repositorio después de revisar las rutas y los derechos de uso.

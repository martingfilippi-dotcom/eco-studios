# ECO Studios Intake

Backend de recepción de solicitudes para el sitio estático de ECO Studios.

## Infraestructura
- Cloudflare Worker: `eco-studios-intake-api`
- Cloudflare D1: `eco-studios-intake` (jurisdicción EU)
- Base canónica: D1. Notion es el panel operativo sincronizado.
- El formulario acepta hasta cinco enlaces HTTPS. No acepta archivos hasta que R2 esté habilitado y configurado.

## Endpoints
- `GET /health`: estado del servicio e integraciones configuradas (sin revelar secretos).
- `POST /api/requests`: valida y guarda una solicitud.

## Integraciones opcionales
Configurar como Worker secrets / variables:
- `NOTION_TOKEN` (secret): token de una integración Notion con acceso a la base.
- `NOTION_DATA_SOURCE_ID` (variable opcional): por defecto utiliza la data source de Contactos y propuestas de ECO Studios.
- `RESEND_API_KEY` (secret): clave API de Resend.
- `EMAIL_FROM` (variable): remitente verificado en Resend, por ejemplo `ECO Studios <notificaciones@TU-DOMINIO-VERIFICADO>`.
- `ADMIN_EMAIL` (variable opcional): por defecto `ecostudiosparaguay@gmail.com`.
- `RATE_LIMIT_SALT` (secret opcional): sal adicional para el hash de IP.

La API no falla al recibir una solicitud si Notion o Resend están temporalmente caídos. D1 conserva el registro; las integraciones quedan pendientes o con error y el Cron programado vuelve a intentarlas. Los correos usan claves de idempotencia separadas por destinatario.

## Despliegue
Desde este directorio con Wrangler:
```bash
npx wrangler deploy
```
El Worker tiene un Cron cada cinco minutos para reintentar Notion y Resend.

## Prueba manual
```bash
curl https://eco-studios-intake-api.martingfilippi.workers.dev/health
```
La prueba POST debe originarse desde el dominio del sitio autorizado y contener ambos consentimientos. Utilizar datos de prueba, nunca datos personales reales.

## Seguridad y privacidad
- Validación de nombre, email, servicio, fecha, horario y referencias HTTPS en servidor.
- Rate limit por hash de IP; no se almacena la IP en claro.
- No registrar tokens ni datos de autenticación en logs.
- No publicar hasta verificar política de privacidad, integraciones y pruebas end-to-end.

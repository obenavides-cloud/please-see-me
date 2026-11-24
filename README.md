# Please See Me Studio

Panel de producción para generar clips de video animado con ComfyUI, administrar un Pod existente en RunPod y validar/concatenar las salidas reales con FFmpeg. No genera storyboards ni convierte imágenes estáticas en animación.

## Ejecutar localmente

Requisitos: Node.js 20.6 o posterior, FFmpeg y ffprobe.

```bash
npm install
cp .env.example .env
npm run build
npm start
```

Abrir <http://localhost:3000>. `npm start` carga `.env` desde el servidor; el navegador no recibe secretos. Nunca enviar `.env` a GitHub.

## Configuración

Completar `.env` localmente. Variables leídas por backend/scripts:

| Variable | Necesaria para | Valor inicial / descripción |
| --- | --- | --- |
| `PORT` | Servidor web | `3000` |
| `PUBLIC_BASE_URL` | Monitor externo de apagado | URL alcanzable desde la máquina del monitor |
| `RUNPOD_API_KEY` | Consultar/reanudar/detener RunPod | Secreto privado |
| `RUNPOD_POD_ID` | Controlar el Pod existente | ID del Pod a controlar |
| `RUNPOD_BILLING_APPROVED` | Habilitar inicio pagado | `false`; cambiar a `true` solo con aprobación |
| `RUNPOD_GPU_RATE_USD` | Presupuestar y calcular coste real | Precio/hora confirmado para ese Pod |
| `RUNPOD_MAX_BUDGET_USD` | Tope acumulado de gasto | `6` |
| `RUNPOD_AUTO_STOP_TOKEN` | Autorizar al monitor de apagado | Token aleatorio, privado |
| `COMFYUI_URL` | Conectar el backend a ComfyUI | URL de API alcanzable desde este servidor |
| `COMFYUI_API_KEY` | Autenticar ComfyUI si está protegido | Opcional |

Para RunPod, `COMFYUI_URL` suele ser el proxy HTTP del puerto 8188 del Pod, accesible desde el servidor backend. No uses `localhost` si ComfyUI corre en otra máquina. El backend consulta `GET /system_stats`, envía `POST /prompt`, consulta `GET /history/{prompt_id}` y descarga por `GET /view`.

`.env` y `.env.*` están excluidos por `.gitignore`; `.env.example` contiene solo nombres/valores no secretos. Confírmalo con `git check-ignore -v .env`.

## RunPod: consentimiento y presupuesto

- El arranque pagado permanece bloqueado salvo que `RUNPOD_BILLING_APPROVED=true` **y** la petición incluya confirmación explícita. La UI también requiere confirmación.
- Solo reanuda `RUNPOD_POD_ID`; no crea Pods ni modifica sus recursos.
- Antes de reanudar, valida precio/hora, presupuesto restante y margen de apagado. Una sesión activa impide otro inicio.
- El valor predeterminado del límite es US$6. Se registra coste estimado según el precio/hora y el tiempo desde inicio hasta apagado.
- La sesión persiste su fecha límite en `data/runpod-session.json` (ignorado por Git).
- El endpoint `POST /api/runpod/auto-stop` detiene el Pod al alcanzar esa fecha; requiere `X-Auto-Stop-Token`.

### Monitor independiente

El endpoint no se ejecuta por sí solo: configurar el monitor en una máquina/proceso independiente del render y programar `scripts/auto-stop.sh` cada minuto. Ejemplo de entrada cron en el host del backend:

```cron
* * * * * cd /ruta/please-see-me && ./scripts/auto-stop.sh >> data/auto-stop.log 2>&1
```

El monitor reevalúa la fecha límite persistida y detiene el Pod cuando vence. Mantiene un margen de seguridad de 120 segundos en el presupuesto para el intervalo de comprobación. Verificar que cron esté activo, que `PUBLIC_BASE_URL` sea alcanzable y que el token sea válido antes de habilitar el arranque. Si el monitor no puede llegar al backend, no se puede garantizar el apagado automático; no iniciar GPU en ese estado.

No habilitar el inicio pagado ni iniciar recursos hasta comprobar el precio exacto, el monitor y el saldo. No se hacen recargas ni se crean suscripciones.

## Generación animada

1. Conectar al ComfyUI existente desde el backend y verificar `/api/comfy/status`.
2. Seleccionar un workflow de video Wan compatible con la VRAM disponible y exportarlo en formato API desde ComfyUI.
3. Enviar los cuatro clips de escenas; los prompts describen movimiento de personajes y cámara.
4. Descargar cada MP4 real generado y validarlo con ffprobe.
5. Unir cuatro clips de aproximadamente cinco segundos a 1920×1080 con FFmpeg.

La selección de modelo y las restricciones para 24 GB VRAM están en [docs/workflow-selection.md](docs/workflow-selection.md). El proyecto aún requiere las credenciales/configuración de RunPod y un workflow ComfyUI compatible; hasta generar y verificar un archivo MP4 real, el piloto no está completo.

## Desarrollo y pruebas

```bash
npm run dev
npm test
npm run build
```

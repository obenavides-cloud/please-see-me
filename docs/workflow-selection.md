# Selección de workflow para 24 GB VRAM

## Arquitectura objetivo

- ComfyUI como motor de generación.
- Wan 2.2 o Wan 2.1 como modelo de imagen-a-video.
- 1920×1080 final.
- Cuatro clips generados de 5 segundos, unidos con FFmpeg.
- Referencia visual de Amaro aplicada a cada entrada.

## Selección de GPU

No iniciar ningún recurso hasta comprobar el saldo, la cuota por hora y la disponibilidad de la GPU exacta.

Para VRAM de 24 GB, una configuración conservadora es preferible:

1. FP8 o GGUF quantizado para pesos de texto/video.
2. Resolución 512×512 o 832×480 por escena.
3. Reescalado final a 1920×1080 solo después de la generación.
4. 5 segundos a 24 fps por escena.
5. Memoria de VAE y atención activadas mediante el mismo perfil comprobado del contenedor.

No se debe asumir que Wan 2.2 14B completo cabe en 24 GB. Wan 2.2 5B o una variante 14B FP8/GGUF puede ser necesaria. Se debe confirmar el archivo de modelo, el nodo y el VRAM real antes del primer render pagado.

## Regla de viabilidad

Primero ejecutar una generación interna de 1 segundo o una de 5 segundos a resolución baja, solo tras habilitación explícita del gasto y del monitor. Estimar:

`coste = segundos_con_GPU / 3600 × precio_por_hora`

El límite de gasto aprobado es US$6. Si cuatro escenas y pruebas superan ese límite, reducir resolución interna, cuantización o duración de pruebas. No recargar ni activar suscripciones.

## Personaje consistente

Usar una imagen o paquete de referencias por escena con las mismas características:

- Rostro de Amaro.
- Cabello.
- Ropa.
- Proporciones.
- Entorno escolar.
- Iluminación cinematográfica.

El workflow JSON debe incluir los nodos de carga de modelo, referencia/condición de personaje, prompting, sampler, VAE y guardado MP4. La versión exacta puede variar según los custom nodes instalados.

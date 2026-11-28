#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
 for d in /workspace/ComfyUI /workspace/runpod-slim/ComfyUI /opt/ComfyUI /ComfyUI; do
  if [[ -f "$d/main.py" ]]; then ROOT="$d"; break; fi
 done
fi
[[ -n "$ROOT" && -f "$ROOT/main.py" ]] || { echo "Pass ComfyUI installation directory as first argument"; exit 1; }
BASE=https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files
download() {
 local dir="$1" name="$2"
 mkdir -p "$ROOT/models/$dir"
 local dest="$ROOT/models/$dir/$name"
 if [[ -s "$dest" ]]; then echo "Already present: $dest"; return; fi
 curl --fail --location --retry 5 --retry-delay 3 --continue-at - --output "$dest.part" "$BASE/$dir/$name"
 mv "$dest.part" "$dest"
}
download diffusion_models wan2.2_ti2v_5B_fp16.safetensors
download text_encoders umt5_xxl_fp8_e4m3fn_scaled.safetensors
download vae wan2.2_vae.safetensors
echo "Models downloaded. Restart ComfyUI if inventory is stale."

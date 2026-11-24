export function comfyUrl(pathname) {
  const base = process.env.COMFYUI_URL || "http://127.0.0.1:8188";
  return new URL(pathname, `${base.replace(/\/$/, "")}/`).toString();
}

function comfyHeaders(extra = {}) {
  const headers = { ...extra };
  if (process.env.COMFYUI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.COMFYUI_API_KEY}`;
  }
  return headers;
}

export async function getComfyStatus() {
  const response = await fetch(comfyUrl("system_stats"), { headers: comfyHeaders() });
  if (!response.ok) throw new Error(`ComfyUI HTTP ${response.status}`);
  return response.json();
}

export async function submitPrompt(prompt) {
  const response = await fetch(comfyUrl("prompt"), {
    method: "POST",
    headers: comfyHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prompt })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `ComfyUI HTTP ${response.status}`);
  return body;
}

export async function getHistory(promptId) {
  const response = await fetch(comfyUrl(`history/${encodeURIComponent(promptId)}`), {
    headers: comfyHeaders()
  });
  if (!response.ok) throw new Error(`ComfyUI HTTP ${response.status}`);
  return response.json();
}

export async function fetchComfyFile(filename, subfolder = "", type = "output") {
  const url = new URL(comfyUrl("view"));
  url.searchParams.set("filename", filename);
  url.searchParams.set("subfolder", subfolder);
  url.searchParams.set("type", type);
  const response = await fetch(url, { headers: comfyHeaders() });
  if (!response.ok) throw new Error(`ComfyUI output HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

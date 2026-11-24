const scenePrompts = [
  "0–5 s: 3D cinematic, Amaro, consistent face, brown hair, school clothes, walks into a school and watches other children playing. Real character animation, natural camera movement.",
  "5–10 s: 3D cinematic, Amaro attempts to approach and join the children, who keep playing. Real gestures and social rejection emotion.",
  "10–15 s: Close emotional 3D portrait of Amaro. Contained sadness and frustration. Real facial expression change, subtle breathing.",
  "15–20 s: Amaro sits alone while other children play in the background. Slow cinematic camera pullback. Emotional, realistic 3D."
];

const sceneList = document.querySelector("#sceneList");
sceneList.innerHTML = scenePrompts.map((prompt, i) =>
  `<div class="scene"><strong>Escena ${i + 1} · 5 s</strong><textarea data-scene="${i}">${prompt}</textarea></div>`
).join("");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

async function refresh() {
  try {
    const health = await api("/api/health");
    document.querySelector("#health").textContent = health.ok ? "Servidor activo" : "Sin conexión";
    document.querySelector("#runpodApi").textContent = health.runpodConfigured ? "Configurada" : "Sin clave";
    document.querySelector("#startPod").disabled = !(health.billingApproved && document.querySelector("#approveStart").checked);
  } catch {
    document.querySelector("#health").textContent = "Servidor desconectado";
  }
  refreshJobs();
  refreshPods();
}

async function refreshPods() {
  try {
    const pods = await api("/api/runpod/pods");
    document.querySelector("#podState").textContent = pods.map((pod) => `${pod.name}: ${pod.desiredStatus}`).join(", ") || "Sin pods";
  } catch (error) {
    document.querySelector("#podState").textContent = error.message;
  }
}

async function refreshJobs() {
  try {
    const jobs = await api("/api/jobs");
    document.querySelector("#jobs").innerHTML = jobs.map((job) => `
      <tr>
        <td>${escapeHtml(job.name)}</td>
        <td>${job.status}</td>
        <td>${job.validation ? `${job.validation.duration.toFixed(2)} s · ${job.validation.width}×${job.validation.height}` : "Pendiente"}</td>
        <td>${job.output ? `<a href="${job.output}" download>Descargar</a>` : job.status === "queued" || job.status === "running" ? `<button data-poll="${job.id}">Actualizar</button>` : ""}</td>
      </tr>
    `).join("") || `<tr><td colspan="4">Sin trabajos</td></tr>`;
  } catch {
    document.querySelector("#jobs").innerHTML = `<tr><td colspan="4">Cola no disponible</td></tr>`;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
}

document.querySelector("#approveStart").addEventListener("change", refresh);

document.querySelector("#startPod").addEventListener("click", async () => {
  try {
    await api("/api/runpod/start", { method:"POST", body: JSON.stringify({ approved:true }) });
    alert("Solicitud de inicio enviada. No cierre esta pestaña hasta que el Pod esté activo.");
  } catch (error) { alert(error.message); }
  refreshPods();
});

document.querySelector("#stopPod").addEventListener("click", async () => {
  try {
    await api("/api/runpod/stop", { method:"POST", body:"{}" });
  } catch (error) { alert(error.message); }
  refreshPods();
});

document.querySelector("#checkComfy").addEventListener("click", async () => {
  try {
    const data = await api("/api/comfy/status");
    document.querySelector("#comfyState").textContent = `Conectado · ${data.system?.device_name || "GPU disponible"}`;
  } catch (error) { document.querySelector("#comfyState").textContent = error.message; }
});

document.querySelector("#queueScenes").addEventListener("click", async () => {
  const file = document.querySelector("#workflowFile").files[0];
  if (!file) return alert("Seleccione el workflow JSON exportado desde ComfyUI.");
  let workflow;
  try { workflow = JSON.parse(await file.text()); } catch { return alert("El archivo no contiene JSON válido."); }
  for (const textarea of document.querySelectorAll("[data-scene]")) {
    const index = Number(textarea.dataset.scene);
    try {
      await api("/api/jobs", {
        method:"POST",
        body: JSON.stringify({ name:`Escena ${index + 1}`, prompt:textarea.value, workflow })
      });
    } catch (error) { alert(error.message); break; }
  }
  refreshJobs();
});

document.querySelector("#mergePilot").addEventListener("click", async () => {
  const jobs = await api("/api/jobs");
  const four = jobs.filter((job) => /^Escena [1-4]$/.test(job.name)).slice(0, 4).map((job) => job.id);
  try {
    const result = await api("/api/production/merge", { method:"POST", body:JSON.stringify({ jobIds:four }) });
    alert(`Piloto válido: ${result.validation.duration.toFixed(2)} s · 1920×1080`);
  } catch (error) { alert(error.message); }
});

document.querySelector("#jobs").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-poll]");
  if (!button) return;
  try { await api(`/api/jobs/${button.dataset.poll}/poll`, { method:"POST", body:"{}" }); } catch (error) { alert(error.message); }
  refreshJobs();
});

refresh();

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
  const state = document.querySelector("#productionState");
  const button = document.querySelector("#queueScenes");
  button.disabled = true;
  try {
    const nodes = await api("/api/comfy/nodes");
    const missing = [...new Set(Object.values(workflow).map(n => n.class_type))].filter(n => !nodes[n]);
    if (missing.length) throw new Error("Nodos no instalados: " + missing.join(", "));
    const candidates = Object.entries(workflow).filter(([,n]) => typeof n?.inputs?.text === "string");
    const positive = candidates.filter(([,n]) => /positive|positivo/i.test(n._meta?.title || ""));
    const nodeId = positive.length === 1 ? positive[0][0] : window.prompt("ID del prompt positivo: " + candidates.map(([id,n]) => id + ": " + (n._meta?.title || n.class_type)).join(", "));
    if (!candidates.some(([id]) => id === nodeId)) throw new Error("Selecciona un nodo de prompt positivo válido.");
    const reference = document.querySelector("#referenceFile").files[0];
    if (reference) {
      if (reference.size > 3500000) throw new Error("Referencia superior a 3.5 MB");
      const loaders = Object.entries(workflow).filter(([,n]) => n.class_type === "LoadImage");
      if (loaders.length !== 1) throw new Error("El workflow debe contener exactamente un LoadImage para la referencia.");
      const image = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(reference); });
      const uploaded = await api("/api/comfy/reference",{method:"POST",body:JSON.stringify({image,mime:reference.type})});
      workflow[loaders[0][0]].inputs.image = [uploaded.subfolder,uploaded.name].filter(Boolean).join("/");
    }
    const batchId = crypto.randomUUID();
    for (const textarea of document.querySelectorAll("[data-scene]")) {
      const index = Number(textarea.dataset.scene);
      state.textContent = "Enviando escena " + (index+1);
      await api("/api/jobs",{method:"POST",body:JSON.stringify({name:"Escena "+(index+1),batchId,prompt:textarea.value,workflow:{...workflow,[nodeId]:{...workflow[nodeId],inputs:{...workflow[nodeId].inputs,text:textarea.value}}}})});
    }
    state.textContent = "Cuatro escenas enviadas. Esperando resultados reales.";
  } catch(error) { state.textContent = error.message; }
  finally { button.disabled = false; }
  refreshJobs();
});

document.querySelector("#mergePilot").addEventListener("click", async () => {
  const jobs = await api("/api/jobs");
  const batchId = jobs.find(job => job.batchId)?.batchId;
  const four = [1,2,3,4].map(n => jobs.find(job => job.batchId === batchId && job.name === `Escena ${n}` && job.status === "completed")?.id).filter(Boolean);
  if (four.length !== 4) return alert("Completa las cuatro escenas antes de unirlas.");
  try {
    const result = await api("/api/production/merge", { method:"POST", body:JSON.stringify({ jobIds:four }) });
    const link = document.createElement("a"); link.href = result.output; link.download = ""; link.click();
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

let polling = false;
setInterval(async () => {
  if (polling) return;
  polling = true;
  try { const jobs = await api("/api/jobs"); for (const job of jobs.filter(j => ["queued","running"].includes(j.status))) { try { await api("/api/jobs/"+job.id+"/poll",{method:"POST",body:"{}"}); } catch {} } await refreshJobs(); } catch {} finally { polling = false; }
}, 15000);

import express from "express";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { publicConfig } from "./config.js";
import { getPods, resumePod, stopPod } from "./runpod.js";
import { getComfyStatus, submitPrompt, getHistory, fetchComfyFile, uploadReference, getNodeInfo } from "./comfy.js";
import { getJobs, saveJobs, getCosts, addCost, getRunpodSession, saveRunpodSession } from "./store.js";
import { concatVideos, validateVideo, normalizeVideo } from "./video.js";
import { getBudget, getSessionCost, getStopAt } from "./budget.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "5mb" }));

const port = Number(process.env.PORT || 3000);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...publicConfig() });
});

app.get("/api/runpod/pods", async (_req, res) => {
  try {
    res.json(await getPods());
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/runpod/start", async (req, res) => {
  if (process.env.RUNPOD_BILLING_APPROVED !== "true") {
    return res.status(403).json({ error: "Paid start blocked: set RUNPOD_BILLING_APPROVED=true only after explicit approval" });
  }
  if (req.body?.approved !== true) {
    return res.status(400).json({ error: "Explicit approval is required" });
  }
  const podId = req.body.podId || process.env.RUNPOD_POD_ID;
  if (!podId) return res.status(400).json({ error: "RUNPOD_POD_ID or podId is required" });
  if (getRunpodSession()) {
    return res.status(409).json({ error: "A RunPod billing session is already active; stop it before starting again" });
  }
  let budget;
  let stopAt;
  const hourlyRateUsd = Number(process.env.RUNPOD_GPU_RATE_USD || 0);
  const startedAt = new Date().toISOString();
  try {
    budget = getBudget(Number(process.env.RUNPOD_MAX_BUDGET_USD || 6), getCosts());
    stopAt = getStopAt(startedAt, budget.remainingUsd, hourlyRateUsd);
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
  const session = { podId, startedAt, stopAt, hourlyRateUsd, budgetLimitUsd: budget.maxBudgetUsd };
  try {
    saveRunpodSession(session);
    const pod = await resumePod(podId);
    res.json({ ...pod, autoStopAt: stopAt, budgetLimitUsd: budget.maxBudgetUsd });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/runpod/stop", async (req, res) => {
  const podId = req.body?.podId || process.env.RUNPOD_POD_ID;
  if (!podId) return res.status(400).json({ error: "RUNPOD_POD_ID or podId is required" });
  try {
    const result = await stopPod(podId);
    const session = getRunpodSession();
    if (session) {
      const stoppedAt = new Date();
      const cost = getSessionCost(session, stoppedAt);
      addCost({ ...cost, podId: session.podId, startedAt: session.startedAt, stoppedAt: stoppedAt.toISOString() });
      saveRunpodSession(null);
    }
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/runpod/auto-stop", async (req, res) => {
  const token = process.env.RUNPOD_AUTO_STOP_TOKEN;
  if (!token || req.headers["x-auto-stop-token"] !== token) {
    return res.status(403).json({ error: "Invalid independent auto-stop token" });
  }
  const session = getRunpodSession();
  if (!session) return res.json({ stopped: false, reason: "no-active-billing-session" });
  if (Date.now() < new Date(session.stopAt).getTime()) {
    return res.json({ stopped: false, autoStopAt: session.stopAt });
  }
  try {
    const result = await stopPod(session.podId);
    const stoppedAt = new Date();
    const cost = getSessionCost(session, stoppedAt);
    addCost({ ...cost, podId: session.podId, startedAt: session.startedAt, stoppedAt: stoppedAt.toISOString() });
    saveRunpodSession(null);
    res.json({ ...result, stopped: true, costUsd: cost.costUsd });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/comfy/status", async (_req, res) => {
  try {
    res.json(await getComfyStatus());
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/comfy/nodes", async (_req,res) => {
  try { res.json(await getNodeInfo()); } catch(e) { res.status(502).json({error:e.message}); }
});
app.post("/api/comfy/reference", async (req,res) => {
  const {image,mime} = req.body || {};
  if (typeof image !== "string" || !["image/png","image/jpeg","image/webp"].includes(mime)) return res.status(400).json({error:"PNG, JPEG or WebP required"});
  const buffer = Buffer.from(image,"base64");
  if (!buffer.length || buffer.length > 3500000) return res.status(400).json({error:"Reference must be under 3.5 MB"});
  try { const result = await uploadReference(buffer, `reference-${crypto.randomUUID()}.${mime.split("/")[1]}`, mime); res.json(result); } catch(e) {res.status(502).json({error:e.message});}
});

app.get("/api/jobs", (_req, res) => res.json(getJobs()));

app.post("/api/jobs", async (req, res) => {
  const { name, prompt, workflow } = req.body || {};
  if (!name || !prompt || typeof workflow !== "object") {
    return res.status(400).json({ error: "name, prompt, and workflow are required" });
  }
  try {
    const result = await submitPrompt(workflow);
    const job = {
      id: crypto.randomUUID(),
      promptId: result.prompt_id,
      name,
      prompt,
      status: "queued",
      createdAt: new Date().toISOString(),
      costUsd: 0
    };
    const jobs = getJobs();
    jobs.unshift(job);
    saveJobs(jobs);
    res.status(202).json(job);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/jobs/:id/poll", async (req, res) => {
  const jobs = getJobs();
  const job = jobs.find((item) => item.id === req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  try {
    const history = await getHistory(job.promptId);
    const entry = history[job.promptId];
    if (!entry) return res.json(job);
    const outputs = entry.outputs || {};
    const outputFiles = Object.values(outputs).flatMap((node) => [...(node.images || []), ...(node.videos || []), ...(node.gifs || [])]);
    const videos = outputFiles.filter((file) => /\.(mp4|mov|webm)$/i.test(file.filename));
    if (videos.length) {
      const video = videos[0];
      const data = await fetchComfyFile(video.filename, video.subfolder || "", video.type || "output");
      const fileName = `${job.id}.mp4`;
      const filePath = path.resolve("data/results", fileName);
      const rawPath = path.resolve("data/results", `${job.id}-native${path.extname(video.filename)}`);
      fs.writeFileSync(rawPath, data);
      const validation = await normalizeVideo(rawPath, filePath);
      job.status = "completed";
      job.output = `/api/results/${encodeURIComponent(fileName)}`;
      job.validation = validation;
      job.completedAt = new Date().toISOString();
      saveJobs(jobs);
    } else {
      job.status = entry.status?.status_str === "error" || entry.status?.completed ? "failed" : "running";
      job.error = entry.status?.messages?.find(m => m[0] === "execution_error")?.[1]?.exception_message || (job.status === "failed" ? "No video output returned by workflow" : undefined);
      saveJobs(jobs);
    }
    res.json(job);
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
    saveJobs(jobs);
    res.status(422).json(job);
  }
});

app.post("/api/production/merge", async (req, res) => {
  const ids = Array.isArray(req.body?.jobIds) ? req.body.jobIds : [];
  const jobs = getJobs();
  const selected = ids.map((id) => jobs.find((job) => job.id === id)).filter(Boolean);
  if (selected.length !== 4) return res.status(400).json({ error: "Exactly four completed scene clips are required" });
  const files = [];
  try {
    for (const job of selected) {
      if (job.status !== "completed" || !job.output) throw new Error(`Scene ${job.name} is not completed`);
      const fileName = path.basename(job.output);
      const file = path.resolve("data/results", fileName);
      const validation = await validateVideo(file, { minDuration: 4.8, width: 1920, height: 1080 });
      if (validation.duration > 5.5) throw new Error(`Scene ${job.name} exceeds 5.5 seconds`);
      files.push(file);
    }
    const outputName = `please-see-me-pilot-${Date.now()}.mp4`;
    const output = path.resolve("data/results", outputName);
    await concatVideos(files, output);
    const validation = await validateVideo(output, { minDuration: 19.8, width: 1920, height: 1080 });
    res.status(201).json({ output: `/api/results/${outputName}`, validation });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

app.get("/api/results/:fileName", (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const file = path.resolve("data/results", fileName);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "File not found" });
  res.download(file);
});

app.get("/api/costs", (_req, res) => res.json(getCosts()));

app.post("/api/costs", (req, res) => {
  const seconds = Number(req.body?.seconds);
  if (!Number.isFinite(seconds) || seconds < 0) return res.status(400).json({ error: "seconds must be non-negative" });
  const costUsd = seconds / 3600 * Number(process.env.RUNPOD_GPU_RATE_USD || 0);
  res.status(201).json(addCost({ seconds, costUsd, podId: process.env.RUNPOD_POD_ID || null }));
});

app.use(express.static(path.resolve("public")));
app.get("*splat", (_req, res) => res.sendFile(path.resolve("public/index.html")));

app.listen(port, () => console.log(`Please See Me Studio listening on http://localhost:${port}`));

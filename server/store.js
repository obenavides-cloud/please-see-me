import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
fs.mkdirSync(path.join(dataDir, "results"), { recursive: true });

function readJson(name, fallback) {
  const file = path.join(dataDir, name);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  const file = path.join(dataDir, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function getJobs() {
  return readJson("jobs.json", []);
}

export function saveJobs(jobs) {
  writeJson("jobs.json", jobs);
}

export function getCosts() {
  return readJson("costs.json", []);
}

export function addCost(entry) {
  const costs = getCosts();
  costs.push({ ...entry, timestamp: new Date().toISOString() });
  writeJson("costs.json", costs);
  return costs;
}

export function getRunpodSession() {
  return readJson("runpod-session.json", null);
}

export function saveRunpodSession(session) {
  const file = path.join(dataDir, "runpod-session.json");
  if (session === null) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  writeJson("runpod-session.json", session);
}

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateVideo, concatVideos } from "../server/video.js";

const exec = promisify(execFile);

test("validates a real 1920x1080 MP4 and rejects short clips", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "psm-test-"));
  const file = path.join(dir, "sample.mp4");
  await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=24", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", file]);
  const result = await validateVideo(file, { minDuration: 1 });
  assert.equal(result.width, 1920);
  assert.equal(result.height, 1080);
  await assert.rejects(validateVideo(file, { minDuration: 2 }), /below/);
  await rm(dir, { recursive: true });
});

test("concat produces a 1920x1080 MP4 at least 20 seconds", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "psm-test-"));
  const inputs = [];
  for (let i = 0; i < 4; i++) {
    const file = path.join(dir, `${i}.mp4`);
    await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `testsrc2=size=1920x1080:rate=24:duration=5`, "-c:v", "libx264", "-pix_fmt", "yuv420p", file]);
    inputs.push(file);
  }
  const output = path.join(dir, "pilot.mp4");
  await concatVideos(inputs, output);
  const result = await validateVideo(output, { minDuration: 19.8 });
  assert.ok(result.duration >= 19.8);
  await rm(dir, { recursive: true });
});

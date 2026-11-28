import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";

const execFileAsync = promisify(execFile);

export async function probeVideo(file) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
    "-of", "json",
    file
  ]);
  return JSON.parse(stdout);
}

export async function validateVideo(file, { minDuration = 1, width = 1920, height = 1080 } = {}) {
  const probe = await probeVideo(file);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const duration = Number(probe.format?.duration || 0);
  if (!video) throw new Error("No video stream found");
  if (duration + 0.05 < minDuration) throw new Error(`Duration ${duration.toFixed(2)}s is below ${minDuration}s`);
  if (video.width !== width || video.height !== height) {
    throw new Error(`Resolution ${video.width}x${video.height} is not ${width}x${height}`);
  }
  return { duration, width: video.width, height: video.height, codec: video.codec_name };
}

export async function concatVideos(inputs, output) {
  if (inputs.length < 1) throw new Error("At least one input is required");
  const list = inputs.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
  const listFile = `${output}.txt`;
  await writeFile(listFile, list);
  await execFileAsync("ffmpeg", [
    "-y", "-v", "error", "-f", "concat", "-safe", "0",
    "-i", listFile, "-an", "-c:v", "libx264",
    "-pix_fmt", "yuv420p", "-r", "24", "-s", "1920x1080", output
  ]);
  await unlink(listFile).catch(() => {});
}

// Normalize actual generated footage without changing its aspect ratio.
export async function normalizeVideo(input, output) {
  await execFileAsync("ffmpeg", ["-y", "-v", "error", "-i", input, "-map", "0:v:0", "-an", "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output]);
  return validateVideo(output);
}

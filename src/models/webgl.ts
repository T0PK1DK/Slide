/** True when this environment can create a WebGL context. Never throws. */
export function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    const ext = (gl as WebGLRenderingContext).getExtension?.("WEBGL_lose_context");
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function parseHexColor(color: string | undefined, fallback = 0xf0a04b): number {
  const raw = (color ?? "").trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(raw)) return fallback;
  return Number.parseInt(raw.slice(1), 16);
}

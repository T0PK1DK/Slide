/**
 * Cheap probe for WebGL support. MapLibre GL JS needs it; when it's missing
 * (a locked-down browser, some VMs, very old devices) map creation still
 * "succeeds" but nothing ever renders and no `load` event ever fires — this
 * catches that case up front instead of waiting out a load timeout to guess
 * at the same conclusion.
 */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Can this browser give us a WebGL context? Some corporate laptops, remote
 * desktops and browsers with hardware acceleration off cannot, and
 * three.js throws when it tries. The canvas factory is injectable so the
 * check is unit-testable without a DOM.
 */
export type ContextCanvas = { getContext: (id: string) => unknown };

export function hasWebGL(createCanvas: () => ContextCanvas | null = defaultCanvas): boolean {
  try {
    const canvas = createCanvas();
    if (!canvas) return false;
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function defaultCanvas(): ContextCanvas | null {
  if (typeof document === "undefined") return null;
  return document.createElement("canvas");
}

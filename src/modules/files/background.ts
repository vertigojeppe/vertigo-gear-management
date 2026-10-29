import { existsSync } from "node:fs";
import sharp from "sharp";
import type { InferenceSession } from "onnxruntime-node";
import { cutOutBackground } from "./cutout";

/**
 * Background removal for model photo thumbnails.
 *
 * With `BG_REMOVE_MODEL` (a BiRefNet ONNX file; the Docker image has one) and
 * `BG_REMOVE_DEVICE` (`cuda` on the GPU server, `cpu` for trying it on a dev
 * machine, slow), BiRefNet draws the mask. Otherwise, or when the model fails,
 * the plain-background cutout (`cutOutBackground`) does what it can.
 */
const SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session: Promise<InferenceSession | null> | undefined;

async function loadSession(): Promise<InferenceSession | null> {
  const model = process.env.BG_REMOVE_MODEL;
  const device = process.env.BG_REMOVE_DEVICE;
  if (!model || !device || !existsSync(model)) return null;
  try {
    const ort = await import("onnxruntime-node");
    return await ort.InferenceSession.create(model, { executionProviders: [device] });
  } catch (e) {
    console.error(`[photos] Could not load the background model on ${device}; using the plain cutout:`, e);
    return null;
  }
}

/** Thumbnail pixels (RGBA, width × height) with the background transparent, or null to leave them as they are. */
export async function removeBackground(source: Buffer, rgba: Uint8Array, width: number, height: number): Promise<Uint8Array | null> {
  const model = await (session ??= loadSession());
  if (model) {
    try {
      const pixels = await sharp(source).rotate().flatten({ background: "#ffffff" }).resize(SIZE, SIZE, { fit: "fill" }).raw().toBuffer();
      const ort = await import("onnxruntime-node");
      const out = await model.run({ [model.inputNames[0]]: new ort.Tensor("float32", planarTensor(pixels, SIZE), [1, 3, SIZE, SIZE]) });
      const logits = out[model.outputNames[0]].data as Float32Array;
      if (logits.length !== SIZE * SIZE) throw new Error(`unexpected mask size ${logits.length}`);
      const mask = await sharp(sigmoidMask(logits), { raw: { width: SIZE, height: SIZE, channels: 1 } }).resize(width, height, { fit: "fill" }).extractChannel(0).raw().toBuffer();
      const cut = Uint8Array.from(rgba);
      for (let p = 0; p < width * height; p++) cut[p * 4 + 3] = Math.min(rgba[p * 4 + 3], mask[p]);
      return cut;
    } catch (e) {
      console.error("[photos] Background model failed; using the plain cutout:", e);
    }
  }
  return cutOutBackground(rgba, width, height);
}

/** RGB pixels → the planar, ImageNet-normalised float input BiRefNet expects. */
export function planarTensor(rgb: Uint8Array, size: number): Float32Array {
  const plane = size * size;
  const t = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) t[c * plane + i] = (rgb[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  return t;
}

/** The model's raw scores → an 8-bit alpha mask. */
export function sigmoidMask(logits: Float32Array): Buffer {
  const mask = Buffer.alloc(logits.length);
  for (let i = 0; i < logits.length; i++) mask[i] = Math.round(255 / (1 + Math.exp(-logits[i])));
  return mask;
}

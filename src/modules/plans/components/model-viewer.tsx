"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

type Labels = { measure: string; measureHint: string; resetView: string; loading: string; distance: string; failed: string };

/**
 * three.js viewer for glTF/GLB, OBJ (+MTL) and STL: orbit/pan/zoom, grid,
 * lights, and a two-point measure tool (click two points on the model).
 * Units are whatever the file uses; the label shows the raw distance.
 */
export function ModelViewer({ url, ext, mtlUrl, labels }: { url: string; ext: string; mtlUrl?: string | null; labels: Labels }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const measuringRef = useRef(false);
  const resetRef = useRef<() => void>(() => {});
  useEffect(() => {
    measuringRef.current = measuring;
  }, [measuring]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f5);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10_000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(5, 10, 7);
    scene.add(sun);
    const grid = new THREE.GridHelper(10, 10, 0x999999, 0xdddddd);
    scene.add(grid);
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    const points: THREE.Vector3[] = [];

    const resize = () => {
      const w = host.clientWidth;
      const h = Math.max(320, Math.min(window.innerHeight * 0.7, w * 0.75));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const fit = () => {
      const box = new THREE.Box3().setFromObject(modelGroup);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(size.length() / 2, 0.01);
      grid.scale.setScalar(Math.max(radius / 5, 0.01));
      grid.position.set(center.x, box.min.y, center.z);
      camera.near = radius / 100;
      camera.far = radius * 100;
      camera.updateProjectionMatrix();
      camera.position.copy(center).add(new THREE.Vector3(radius * 1.2, radius * 0.9, radius * 1.6));
      controls.target.copy(center);
      controls.update();
    };
    resetRef.current = fit;

    const onLoaded = (obj: THREE.Object3D) => {
      if (disposed) return;
      modelGroup.add(obj);
      fit();
      setStatus("ready");
    };
    const onError = (err: unknown) => {
      if (disposed) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    };
    try {
      if (ext === "glb" || ext === "gltf") {
        new GLTFLoader().load(url, (g) => onLoaded(g.scene), undefined, onError);
      } else if (ext === "obj") {
        const load = (materials?: MTLLoader.MaterialCreator) => {
          const loader = new OBJLoader();
          if (materials) {
            materials.preload();
            loader.setMaterials(materials);
          }
          loader.load(url, onLoaded, undefined, onError);
        };
        if (mtlUrl) new MTLLoader().load(mtlUrl, load, undefined, () => load());
        else load();
      } else if (ext === "stl") {
        new STLLoader().load(
          url,
          (geometry) => {
            geometry.computeVertexNormals();
            onLoaded(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.1, roughness: 0.7 })));
          },
          undefined,
          onError,
        );
      } else {
        onError(new Error(`Unsupported format .${ext}`));
      }
    } catch (err) {
      onError(err);
    }

    const raycaster = new THREE.Raycaster();
    const onClick = (e: PointerEvent) => {
      if (!measuringRef.current) return;
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(modelGroup, true)[0];
      if (!hit) return;
      if (points.length >= 2) {
        points.length = 0;
        measureGroup.clear();
        setDistance(null);
      }
      points.push(hit.point.clone());
      const marker = new THREE.Mesh(new THREE.SphereGeometry(camera.position.distanceTo(controls.target) / 150, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe11d48 }));
      marker.position.copy(hit.point);
      measureGroup.add(marker);
      if (points.length === 2) {
        measureGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xe11d48 })));
        setDistance(points[0].distanceTo(points[1]));
      }
    };
    let downAt: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (downAt = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) onClick(e);
      downAt = null;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    let frame = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [url, ext, mtlUrl]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className={`rounded border px-2 py-1 ${measuring ? "bg-foreground text-background" : ""}`} onClick={() => setMeasuring((m) => !m)} aria-pressed={measuring}>
          {labels.measure}
        </button>
        <button type="button" className="rounded border px-2 py-1" onClick={() => resetRef.current()}>
          {labels.resetView}
        </button>
        {measuring && <span className="text-xs text-muted-foreground">{labels.measureHint}</span>}
        {distance !== null && (
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {labels.distance}: {distance.toFixed(3)}
          </span>
        )}
        {status === "loading" && <span className="text-xs text-muted-foreground">{labels.loading}</span>}
      </div>
      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {labels.failed} {error}
        </p>
      )}
      <div ref={hostRef} className="w-full overflow-hidden rounded-md border" />
    </div>
  );
}

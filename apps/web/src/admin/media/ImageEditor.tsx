import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { Button, Modal, Select } from "../../shared/ui";
import { canReencode, centeredOffset, clampOffset, coverScale, formatBytes, frameFor, loadBitmap, processImage, sourceRect } from "../../shared/imageTools";
import type { OutFormat } from "../../shared/imageTools";

export const ASPECTS: { id: string; label: string; ratio: number | null }[] = [
  { id: "original", label: "Original (no crop)", ratio: null },
  { id: "1:1", label: "Square 1:1", ratio: 1 },
  { id: "4:3", label: "Photo 4:3", ratio: 4 / 3 },
  { id: "16:9", label: "Wide 16:9", ratio: 16 / 9 },
  { id: "3:1", label: "Banner 3:1", ratio: 3 },
  { id: "3:4", label: "Portrait 3:4", ratio: 3 / 4 },
];

interface Props {
  file: File;
  title?: string;
  confirmLabel?: string;
  defaultAspect?: string; // an id from ASPECTS
  onCancel: () => void;
  onDone: (file: File) => void | Promise<void>;
}

const BOX_W = 480;
const BOX_H = 320;

/** Crop (drag to move, slider to zoom), resize, and compress in the browser before anything is uploaded. */
export default function ImageEditor({ file, title = "Edit image", confirmLabel = "Use this image", defaultAspect = "original", onCancel, onDone }: Props) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [loadError, setLoadError] = useState("");
  const [aspectId, setAspectId] = useState(defaultAspect);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ offsetX: 0, offsetY: 0 });
  const [maxEdge, setMaxEdge] = useState(2560);
  const [quality, setQuality] = useState(0.85);
  const [format, setFormat] = useState<OutFormat>("webp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const gif = !canReencode(file);

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);
  useEffect(() => {
    let alive = true;
    loadBitmap(file).then((b) => { if (alive) setBitmap(b); else b.close(); }).catch(() => alive && setLoadError("This image could not be read."));
    return () => { alive = false; };
  }, [file]);
  useEffect(() => () => { bitmap?.close(); }, [bitmap]);

  const ratio = ASPECTS.find((a) => a.id === aspectId)?.ratio ?? null;
  const imgW = bitmap?.width ?? 1;
  const imgH = bitmap?.height ?? 1;
  const { frameW, frameH } = frameFor(ratio ?? imgW / imgH, BOX_W, BOX_H);
  const view = { frameW, frameH, imgW, imgH, zoom: ratio === null ? 1 : zoom, ...offset };
  const scale = coverScale(view) * view.zoom;

  // Whenever the frame shape changes, start centred and unzoomed.
  useEffect(() => {
    setZoom(1);
    setOffset(centeredOffset({ frameW, frameH, imgW, imgH, zoom: 1 }));
  }, [aspectId, frameW, frameH, imgW, imgH]);

  function changeZoom(z: number) {
    // Keep the point at the centre of the frame fixed while zooming.
    const s0 = coverScale(view) * view.zoom;
    const cx = (frameW / 2 - offset.offsetX) / s0;
    const cy = (frameH / 2 - offset.offsetY) / s0;
    const s1 = coverScale(view) * z;
    setZoom(z);
    setOffset(clampOffset({ ...view, zoom: z, offsetX: frameW / 2 - cx * s1, offsetY: frameH / 2 - cy * s1 }));
  }
  const pan = (dx: number, dy: number) => setOffset((o) => clampOffset({ ...view, offsetX: o.offsetX + dx, offsetY: o.offsetY + dy }));

  function down(e: PointerEvent<HTMLDivElement>) {
    if (ratio === null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.offsetX, oy: offset.offsetY };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setOffset(clampOffset({ ...view, offsetX: d.ox + (e.clientX - d.x), offsetY: d.oy + (e.clientY - d.y) }));
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 10;
    const m: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (m[e.key] && ratio !== null) { e.preventDefault(); pan(...m[e.key]); }
  }

  async function apply() {
    if (!bitmap) return;
    setBusy(true); setError("");
    try {
      const out = await processImage(file, bitmap, { crop: ratio === null ? undefined : sourceRect(view), maxEdge, quality, format });
      await onDone(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process the image.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onCancel} size="lg" title={title}
      footer={<>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="secondary" disabled={busy} onClick={() => onDone(file)}>Use original ({formatBytes(file.size)})</Button>
        {!gif && <Button loading={busy} disabled={!bitmap} onClick={apply}>{confirmLabel}</Button>}
      </>}>
      {loadError ? <p role="alert" className="text-danger">{loadError}</p> : (
        <div className="flex flex-col gap-4">
          <div
            data-testid="crop-frame"
            tabIndex={ratio === null ? -1 : 0}
            role="group"
            aria-label={ratio === null ? "Image preview" : "Crop area. Drag the image, or use the arrow keys, to choose what stays."}
            className="relative mx-auto touch-none select-none overflow-hidden rounded-control border border-line bg-bg"
            style={{ width: frameW, height: frameH, cursor: ratio === null ? "default" : "grab" }}
            onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={key}
          >
            <img src={previewUrl} alt="" draggable={false} className="absolute max-w-none" style={{ left: offset.offsetX, top: offset.offsetY, width: imgW * scale, height: imgH * scale }} />
          </div>
          {gif ? (
            <p>Animated GIFs are uploaded as they are, so the animation is not lost. Use a PNG, JPEG, or WebP to crop or compress.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Crop shape" value={aspectId} onChange={(e) => setAspectId(e.target.value)}>
                  {ASPECTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                  Zoom
                  <input type="range" min={1} max={4} step={0.05} value={view.zoom} disabled={ratio === null} aria-label="Zoom" onChange={(e) => changeZoom(Number(e.target.value))} className="h-10 accent-[var(--color-accent)]" />
                </label>
                <Select label="Largest side" value={maxEdge} onChange={(e) => setMaxEdge(Number(e.target.value))}>
                  <option value={0}>Keep size</option>
                  <option value={2560}>2560 px</option>
                  <option value={1920}>1920 px</option>
                  <option value={1280}>1280 px</option>
                  <option value={800}>800 px</option>
                </Select>
                <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as OutFormat)}>
                  <option value="webp">WebP (smallest, keeps transparency)</option>
                  <option value="jpeg">JPEG (no transparency)</option>
                  <option value="png">PNG (lossless, larger)</option>
                </Select>
                <Select label="Quality" value={quality} onChange={(e) => setQuality(Number(e.target.value))} disabled={format === "png"}>
                  <option value={0.92}>High</option>
                  <option value={0.85}>Balanced</option>
                  <option value={0.7}>Small file</option>
                </Select>
              </div>
              <p className="text-xs">Original: {bitmap ? `${bitmap.width} × ${bitmap.height} px, ` : ""}{formatBytes(file.size)}. Nothing is uploaded until you confirm.</p>
            </>
          )}
          {error && <p role="alert" className="text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

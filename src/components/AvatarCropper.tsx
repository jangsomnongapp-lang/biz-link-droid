import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useI18n } from "@/lib/i18n";

interface Props {
  src: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
  saving?: boolean;
  cropShape?: "round" | "rect";
  /** When omitted for rect crop, the image's natural aspect ratio is preserved. */
  aspect?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function getCroppedImage(src: string, area: Area, square: boolean): Promise<string> {
  const image = await loadImage(src);
  const maxSize = 1280;
  let outW: number;
  let outH: number;
  if (square) {
    outW = outH = 512;
  } else {
    const scale = Math.min(1, maxSize / Math.max(area.width, area.height));
    outW = Math.round(area.width * scale);
    outH = Math.round(area.height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function AvatarCropper({ src, onCancel, onConfirm, saving, cropShape = "round", aspect }: Props) {
  const { lang } = useI18n();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);

  // For rect crops without an explicit aspect, preserve the image's natural aspect.
  const preserveNatural = cropShape === "rect" && aspect == null;
  const effectiveAspect = aspect ?? (cropShape === "round" ? 1 : naturalAspect ?? 1);

  useEffect(() => {
    if (!preserveNatural) return;
    let cancelled = false;
    void loadImage(src).then((img) => {
      if (!cancelled) setNaturalAspect(img.naturalWidth / img.naturalHeight);
    });
    return () => { cancelled = true; };
  }, [src, preserveNatural]);

  const onComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPx(pixels);
  }, []);

  async function handleConfirm() {
    if (!areaPx) return;
    const out = await getCroppedImage(src, areaPx, cropShape === "round" || aspect === 1);
    onConfirm(out);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={0.5}
          maxZoom={3}
          aspect={effectiveAspect}
          cropShape={cropShape}
          showGrid={false}
          objectFit={preserveNatural ? "contain" : "cover"}
          restrictPosition={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
        />
      </div>
      <div className="space-y-3 bg-surface p-4">
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-11 flex-1 rounded-lg border border-border bg-background text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {lang === "km" ? "បោះបង់" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={saving || !areaPx}
            className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? (lang === "km" ? "កំពុង..." : "Saving...") : (lang === "km" ? "រក្សាទុក" : "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

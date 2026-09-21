"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { getCroppedImageBlob } from "@/lib/cropImage";

/**
 * Diego's ask (2026-09-22, on the group cover photo): "let users zoom in
 * or out of the image when uploading and show them the frame of how it
 * will look." Before this, both SettingsPanel and CreateGroupForm just
 * took whatever raw photo was picked and let CSS `object-cover` crop it
 * however it landed — which is exactly what produced the awkwardly
 * cropped face in his screenshots, with no way for the uploader to fix
 * it. This modal opens on the raw file, lets them pan/zoom inside a
 * frame shaped exactly like the final banner, and hands back an
 * already-cropped Blob at a fixed output size (see lib/cropImage.ts).
 *
 * A plain, reusable component rather than something baked into either
 * form — SettingsPanel and CreateGroupForm both use it the same way,
 * and any future "let me crop this photo" spot in the app can too.
 */
export function ImageCropperModal({
  imageSrc,
  aspect,
  outputWidth,
  outputHeight,
  onCancel,
  onConfirm,
}: {
  imageSrc: string;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setIsSaving(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(
        imageSrc,
        croppedAreaPixels,
        outputWidth,
        outputHeight,
      );
      onConfirm(blob);
    } catch {
      setError("Couldn't crop that image. Try a different file.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <h3 className="font-semibold">Adjust your photo</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Drag to reposition, use the slider to zoom. The frame below is
          exactly how it&apos;ll look as the banner.
        </p>

        <div
          className="relative mt-3 w-full overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800"
          style={{ aspectRatio: aspect }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-full border border-black/[.12] px-4 py-2 text-sm font-medium transition-colors hover:border-zinc-400 disabled:opacity-60 dark:border-white/[.15] dark:hover:border-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || !croppedAreaPixels}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Use this crop"}
          </button>
        </div>
      </div>
    </div>
  );
}

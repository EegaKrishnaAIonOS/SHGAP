import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/Button";
import { deleteProductImage, uploadProductImage } from "../lib/api/products";
import type { ProductImage } from "../lib/api/types";

export interface ProductImageCaptureProps {
  productId: string;
  images: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
}

/**
 * Per-product photo capture: a live camera stream (getUserMedia -> <video>
 * -> a frame drawn to <canvas> -> Blob) OR a plain gallery file picker,
 * both funnelled into the same upload path (progress bar, retry with
 * backoff, offline-queue fallback — see src/lib/api/products.ts).
 */
export function ProductImageCapture({
  productId,
  images,
  onImagesChange,
}: ProductImageCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function openCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // The <video> element only mounts once cameraOpen flips true, so wait a tick before attaching.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError(t("catalogue.photos.cameraUnavailable"));
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) void handleUpload(blob, `capture-${Date.now()}.jpg`);
      },
      "image/jpeg",
      0.85,
    );
    stopCamera();
  }

  function handleGalleryPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleUpload(file, file.name);
  }

  async function handleUpload(blob: Blob, filename: string) {
    setError(null);
    setNotice(null);
    setUploadProgress(0);
    try {
      const result = await uploadProductImage(productId, blob, filename, (percent) =>
        setUploadProgress(percent),
      );
      if (result.status === "ok") {
        onImagesChange([...images, result.data]);
      } else {
        setNotice(t("catalogue.photos.queuedOffline"));
      }
    } catch {
      setError(t("catalogue.photos.uploadFailed"));
    } finally {
      setUploadProgress(null);
    }
  }

  async function handleDelete(imageId: string) {
    const result = await deleteProductImage(productId, imageId);
    if (result.status === "ok") {
      onImagesChange(images.filter((img) => img.id !== imageId));
    } else {
      setNotice(t("catalogue.photos.queuedOffline"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-neutral-700">{t("catalogue.photos.title")}</p>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative h-20 w-20 overflow-hidden rounded-md border border-neutral-200"
            >
              <img src={image.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => void handleDelete(image.id)}
                aria-label={t("catalogue.photos.deleteImage")}
                className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {cameraOpen ? (
        <div className="flex flex-col gap-2">
          <video ref={videoRef} className="w-full rounded-md bg-neutral-900" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button type="button" size="touch" fullWidth onClick={capturePhoto}>
              {t("catalogue.photos.capture")}
            </Button>
            <Button type="button" variant="outline" size="touch" fullWidth onClick={stopCamera}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            fullWidth
            onClick={() => void openCamera()}
          >
            <span aria-hidden="true">📷</span> {t("catalogue.photos.openCamera")}
          </Button>
          <label className="flex min-h-touch flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-neutral-300 px-6 text-lg font-medium text-neutral-800 hover:bg-neutral-50">
            <span aria-hidden="true">🖼️</span>
            {t("catalogue.photos.chooseFromGallery")}
            <input type="file" accept="image/*" className="sr-only" onChange={handleGalleryPick} />
          </label>
        </div>
      )}

      {uploadProgress !== null && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-brand-400 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500">
            {t("catalogue.photos.uploading", { percent: uploadProgress })}
          </span>
        </div>
      )}

      {notice && <p className="text-sm text-warning-700">{notice}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger-500">
          {error}
        </p>
      )}
    </div>
  );
}

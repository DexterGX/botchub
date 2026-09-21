import type { Area } from "react-easy-crop";

/** Renders the selected crop rectangle of `imageSrc` onto an
 * `outputWidth`×`outputHeight` canvas and resolves a JPEG Blob — the
 * shared piece behind ImageCropperModal (see that component's own doc
 * comment for why this exists). A fixed output size means every upload
 * that goes through the cropper ends up a predictable, already-reasonably
 * -sized file regardless of how huge the original photo was, without
 * needing a separate "resize before upload" step. JPEG at a high quality
 * setting rather than PNG — these are photos, and PNG would produce a
 * needlessly large file for the same visual result. */
export async function getCroppedImageBlob(
  imageSrc: string,
  croppedAreaPixels: Area,
  outputWidth: number,
  outputHeight: number,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't get a 2D canvas context.");

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Couldn't export the cropped image."));
      },
      "image/jpeg",
      0.92,
    );
  });
}

// Group cover photo geometry — shared between CreateGroupForm and
// SettingsPanel so both crop tools produce output that matches exactly
// how the banner is actually displayed everywhere else (GroupCard,
// SettingsPanel's own preview, CreateGroupForm's own preview all use
// `h-28 w-full object-cover` inside the same max-w-5xl grid). A card at
// that grid's typical rendered width works out to roughly a 2.7:1
// banner, so the crop frame matches that instead of a generic square or
// widescreen ratio that wouldn't match what visitors actually see.
export const GROUP_COVER_ASPECT = 2.7;
export const GROUP_COVER_OUTPUT_WIDTH = 810;
export const GROUP_COVER_OUTPUT_HEIGHT = 300;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Couldn't load that image.")),
    );
    image.src = src;
  });
}

// TODO: Validate
import { imageHeight, imageWidth, type LoadedImage } from "../common/image-loader";

// TODO: Validate
export function channelLogoNeedsLightBackground(channelLogoImage: LoadedImage): boolean {
  const logoWidth = imageWidth(channelLogoImage);
  const logoHeight = imageHeight(channelLogoImage);
  if (logoWidth === 0 || logoHeight === 0) return false;
  const logoCanvas = new OffscreenCanvas(logoWidth, logoHeight);
  const logoContext = logoCanvas.getContext("2d");
  if (logoContext === null) return false;
  logoContext.drawImage(channelLogoImage, 0, 0);
  try {
    const logoRgbaPixels = logoContext.getImageData(0, 0, logoWidth, logoHeight).data;
    return hasDarkEdgesOnTransparency(rgbaToArgbPixels(logoRgbaPixels), logoWidth, logoHeight);
  } catch {
    return false;
  }
}

// TODO: Validate
function rgbaToArgbPixels(rgbaPixels: Uint8ClampedArray): Uint32Array {
  const argbPixels = new Uint32Array(rgbaPixels.length / 4);
  for (let pixelIndex = 0; pixelIndex < argbPixels.length; pixelIndex++) {
    const rgbaOffset = pixelIndex * 4;
    argbPixels[pixelIndex] =
      (((rgbaPixels[rgbaOffset + 3] ?? 0) << 24) |
        ((rgbaPixels[rgbaOffset] ?? 0) << 16) |
        ((rgbaPixels[rgbaOffset + 1] ?? 0) << 8) |
        (rgbaPixels[rgbaOffset + 2] ?? 0)) >>>
      0;
  }
  return argbPixels;
}

// TODO: Validate
export function hasDarkEdgesOnTransparency(
  argbPixels: ArrayLike<number>,
  imageWidthPixels: number,
  imageHeightPixels: number,
): boolean {
  // TODO: Validate
  const isTransparent = (pixelX: number, pixelY: number): boolean =>
    pixelX < 0 ||
    pixelY < 0 ||
    pixelX >= imageWidthPixels ||
    pixelY >= imageHeightPixels ||
    (argbPixels[pixelY * imageWidthPixels + pixelX] ?? 0) >>> 24 < 128;

  let transparentPixelCount = 0;
  let edgePixelCount = 0;
  let darkEdgePixelCount = 0;
  for (let pixelY = 0; pixelY < imageHeightPixels; pixelY++) {
    for (let pixelX = 0; pixelX < imageWidthPixels; pixelX++) {
      if (isTransparent(pixelX, pixelY)) {
        transparentPixelCount++;
        continue;
      }
      if (
        !isTransparent(pixelX - 1, pixelY) &&
        !isTransparent(pixelX + 1, pixelY) &&
        !isTransparent(pixelX, pixelY - 1) &&
        !isTransparent(pixelX, pixelY + 1)
      ) {
        continue;
      }
      edgePixelCount++;
      const edgePixel = argbPixels[pixelY * imageWidthPixels + pixelX] ?? 0;
      const edgeLuminance =
        (0.2126 * ((edgePixel >>> 16) & 0xff) + 0.7152 * ((edgePixel >>> 8) & 0xff) + 0.0722 * (edgePixel & 0xff)) /
        255;
      if (edgeLuminance < 0.35) darkEdgePixelCount++;
    }
  }
  return transparentPixelCount >= imageWidthPixels * imageHeightPixels * 0.1 && darkEdgePixelCount > edgePixelCount / 2;
}

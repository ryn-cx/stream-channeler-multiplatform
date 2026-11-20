// TODO: Validate
import GM_fetch from "@trim21/gm-fetch";

export type LoadedImage = HTMLImageElement | ImageBitmap;

// TODO: Validate
export class ImageLoader {
  private readonly urlToLoadedImage = new Map<string, LoadedImage>();
  private readonly urlToWaitingCallbacks = new Map<string, (() => void)[]>();
  private readonly failedUrls = new Set<string>();

  // TODO: Validate
  loadInto(imageElement: HTMLImageElement, imageUrl: string | null): void {
    // Like the Android app, only web addresses are loaded, and an address that failed before is not tried again.
    if (imageUrl === null || !isWebImageUrl(imageUrl) || this.failedUrls.has(imageUrl)) {
      imageElement.removeAttribute("src");
      imageElement.hidden = true;
      return;
    }
    imageElement.hidden = false;
    imageElement.onerror = () => {
      this.failedUrls.add(imageUrl);
      imageElement.hidden = true;
    };
    imageElement.src = imageUrl;
  }

  // TODO: Validate
  cachedImage(imageUrl: string | null): LoadedImage | null {
    return imageUrl === null ? null : (this.urlToLoadedImage.get(imageUrl) ?? null);
  }

  // TODO: Validate
  loadImage(imageUrl: string, readsPixels: boolean, onLoaded: () => void): void {
    if (!isWebImageUrl(imageUrl) || this.urlToLoadedImage.has(imageUrl) || this.failedUrls.has(imageUrl)) return;
    const waitingCallbacks = this.urlToWaitingCallbacks.get(imageUrl);
    if (waitingCallbacks !== undefined) {
      waitingCallbacks.push(onLoaded);
      return;
    }
    this.urlToWaitingCallbacks.set(imageUrl, [onLoaded]);
    const imageLoad = readsPixels ? loadPixelReadableImage(imageUrl) : loadDisplayedImage(imageUrl);
    imageLoad.then(
      (loadedImage) => {
        this.urlToLoadedImage.set(imageUrl, loadedImage);
        for (const waitingCallback of this.urlToWaitingCallbacks.get(imageUrl) ?? []) waitingCallback();
        this.urlToWaitingCallbacks.delete(imageUrl);
      },
      () => {
        this.failedUrls.add(imageUrl);
        this.urlToWaitingCallbacks.delete(imageUrl);
      },
    );
  }
}

// TODO: Validate
function isWebImageUrl(imageUrl: string): boolean {
  return imageUrl.startsWith("http");
}

// TODO: Validate
async function loadPixelReadableImage(imageUrl: string): Promise<LoadedImage> {
  const imageResponse = await GM_fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`${imageUrl} answered ${imageResponse.status}`);
  return createImageBitmap(await imageResponse.blob());
}

// TODO: Validate
function loadDisplayedImage(imageUrl: string): Promise<LoadedImage> {
  return new Promise((resolveImage, rejectImage) => {
    const displayedImage = new Image();
    displayedImage.decoding = "async";
    displayedImage.onload = () => resolveImage(displayedImage);
    displayedImage.onerror = () => rejectImage(new Error(`${imageUrl} didn't load`));
    displayedImage.src = imageUrl;
  });
}

// TODO: Validate
export function imageWidth(loadedImage: LoadedImage): number {
  return loadedImage instanceof HTMLImageElement ? loadedImage.naturalWidth : loadedImage.width;
}

// TODO: Validate
export function imageHeight(loadedImage: LoadedImage): number {
  return loadedImage instanceof HTMLImageElement ? loadedImage.naturalHeight : loadedImage.height;
}

// TODO: Validate
import type { AdMarker } from "./ad-marker";

// TODO: Validate
export class AdWatcher {
  private readonly adMarker: AdMarker;
  private readonly isVideoPlaying: () => boolean;
  private readonly onAdStateChanged: (isAdShowing: boolean) => void;
  private adCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private isAdShowing = false;

  // TODO: Validate
  constructor(adMarker: AdMarker, isVideoPlaying: () => boolean, onAdStateChanged: (isAdShowing: boolean) => void) {
    this.adMarker = adMarker;
    this.isVideoPlaying = isVideoPlaying;
    this.onAdStateChanged = onAdStateChanged;
  }

  // TODO: Validate
  start(): void {
    this.adCheckIntervalId = setInterval(() => this.checkForAd(), 500);
  }

  // TODO: Validate
  stop(): void {
    if (this.adCheckIntervalId !== null) clearInterval(this.adCheckIntervalId);
    this.adCheckIntervalId = null;
    if (this.isAdShowing) {
      this.isAdShowing = false;
      this.onAdStateChanged(false);
    }
  }

  // TODO: Validate
  private checkForAd(): void {
    const isAdShowingNow = this.adMarker.isShowing(document) && this.isVideoPlaying();
    if (isAdShowingNow === this.isAdShowing) return;
    this.isAdShowing = isAdShowingNow;
    this.onAdStateChanged(isAdShowingNow);
  }
}

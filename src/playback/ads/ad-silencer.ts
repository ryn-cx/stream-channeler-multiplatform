// TODO: Validate
import { findEveryVideo } from "../../mediasessions/video-observation";
import { StatusMessageOverlay } from "../../screenautomation/status-message-overlay";

// TODO: Validate
export class AdSilencer {
  private readonly videosMutedForAds = new Set<HTMLVideoElement>();
  private isSilencing = false;
  private adSilencedMessageOverlay: StatusMessageOverlay | null = null;

  // TODO: Validate
  silence(): void {
    const wasSilencing = this.isSilencing;
    this.isSilencing = true;
    this.muteUnmutedVideos();
    // The message tells the viewer why the video went quiet.
    if (!wasSilencing) {
      this.adSilencedMessageOverlay ??= new StatusMessageOverlay();
      // The message is hidden as soon as the ad ends. This limit is only a backstop, so that a missed hide can never leave
      // the message on screen for good.
      this.adSilencedMessageOverlay.show("Ad silenced", 10 * 60 * 1_000);
    }
  }

  // TODO: Validate
  keepSilencingNewVideos(): void {
    if (this.isSilencing) this.muteUnmutedVideos();
  }

  // TODO: Validate
  restore(): void {
    this.isSilencing = false;
    this.adSilencedMessageOverlay?.hide();
    for (const videoMutedForAds of this.videosMutedForAds) videoMutedForAds.muted = false;
    this.videosMutedForAds.clear();
  }

  // TODO: Validate
  private muteUnmutedVideos(): void {
    for (const pageVideo of findEveryVideo(document)) {
      if (pageVideo.muted) continue;
      pageVideo.muted = true;
      this.videosMutedForAds.add(pageVideo);
    }
  }
}

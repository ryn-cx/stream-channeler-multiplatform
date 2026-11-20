// TODO: Validate
import type { EndedMedia, EpisodeState } from "../playback-end-detector";
import type { PlaybackEndRule } from "./playback-end-rule";

// TODO: Validate
export class BrowserMediaEndedEndsVideo implements PlaybackEndRule {
  private ignoresMediaEndedUntil = Number.POSITIVE_INFINITY;

  // TODO: Validate
  onPlaybackStarted(now: number): void {
    this.ignoresMediaEndedUntil = now;
  }

  // TODO: Validate
  episodeState(): EpisodeState | null {
    return null;
  }

  // TODO: Validate
  episodeStateFromEndedVideo(endedMedia: EndedMedia): EpisodeState | null {
    if (endedMedia.endedAt <= this.ignoresMediaEndedUntil) return null;
    this.ignoresMediaEndedUntil = endedMedia.endedAt;
    return "FINISHED";
  }
}

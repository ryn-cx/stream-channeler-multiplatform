// TODO: Validate
import type { EpisodeState, MediaObservation } from "../playback-end-detector";
import type { PlaybackEndCheck, PlaybackEndRule } from "./playback-end-rule";

// TODO: Validate
/**
 * Finishes the video once the video's media ID changes. In the browser, the media ID is the video's current source
 * address, which changes when a player loads a new stream for the next episode. This is for sites that report neither
 * a usable duration nor a title, and that go straight into the next episode without stopping.
 */
export class MediaIdChangeEndsVideo implements PlaybackEndRule {
  private currentMediaId: string | null = null;

  // TODO: Validate
  onPlaybackStarted(_now: number, observation: MediaObservation): void {
    this.currentMediaId = observation.mediaId ?? null;
  }

  // TODO: Validate
  episodeState(playbackEndCheck: PlaybackEndCheck): EpisodeState | null {
    const observedMediaId = playbackEndCheck.observation?.mediaId ?? null;
    if (observedMediaId === null) return null;
    if (this.currentMediaId === null || observedMediaId === this.currentMediaId) {
      this.currentMediaId = observedMediaId;
      return null;
    }
    return "FINISHED";
  }
}

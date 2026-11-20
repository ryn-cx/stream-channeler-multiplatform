// TODO: Validate
import type { EpisodeState } from "../playback-end-detector";
import type { PlaybackEndRule } from "./playback-end-rule";

// TODO: Validate
export class OnScreenElementEndsVideo implements PlaybackEndRule {
  private readonly findOnScreenElement: () => HTMLElement | null;

  // TODO: Validate
  constructor(findOnScreenElement: () => HTMLElement | null) {
    this.findOnScreenElement = findOnScreenElement;
  }

  // TODO: Validate
  // The video does not have to be playing. Disney+, for one, shrinks or stops the video when it shows its full page
  // play next view.
  episodeState(): EpisodeState | null {
    return this.findOnScreenElement() === null ? null : "FINISHED";
  }
}

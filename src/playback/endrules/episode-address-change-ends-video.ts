// TODO: Validate
import type { EpisodeState } from "../playback-end-detector";
import type { PlaybackEndCheck, PlaybackEndRule } from "./playback-end-rule";

// TODO: Validate
/**
 * Finishes the video once the episode named in the page's address changes. This is for sites that move on to the
 * next episode in the same page, and change the address to the next episode's id as they do.
 *
 * The site gives a pattern whose first group captures the episode id from the address's path. Addresses that the
 * pattern does not match are ignored, so loading pages and redirects before the episode page do not count.
 */
export class EpisodeAddressChangeEndsVideo implements PlaybackEndRule {
  private readonly episodeIdPattern: RegExp;
  /** The episode id in the address while the video played, or null until an address with an id is seen. */
  private playingEpisodeId: string | null = null;

  // TODO: Validate
  constructor(episodeIdPattern: RegExp) {
    this.episodeIdPattern = episodeIdPattern;
  }

  // TODO: Validate
  episodeState(playbackEndCheck: PlaybackEndCheck): EpisodeState | null {
    const addressEpisodeId = this.episodeIdIn(playbackEndCheck.pageAddress);
    if (addressEpisodeId === null) return null;
    // The detector only asks rules for a verdict after playback starts, so the first id seen is the playing episode.
    if (this.playingEpisodeId === null) {
      this.playingEpisodeId = addressEpisodeId;
      return null;
    }
    return addressEpisodeId !== this.playingEpisodeId ? "FINISHED" : null;
  }

  // TODO: Validate
  private episodeIdIn(pageAddress: string | null): string | null {
    if (pageAddress === null) return null;
    let addressPath: string;
    try {
      addressPath = new URL(pageAddress).pathname;
    } catch {
      return null;
    }
    return this.episodeIdPattern.exec(addressPath)?.[1] ?? null;
  }
}

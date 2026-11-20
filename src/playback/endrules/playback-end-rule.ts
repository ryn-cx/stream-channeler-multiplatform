// TODO: Validate
import type { EndedMedia, EpisodeState, MediaObservation } from "../playback-end-detector";

export interface PlaybackEndCheck {
  /** The page's video, or null on a poll on which the page shows no video. */
  observation: MediaObservation | null;
  /** The address of the top page, or null when it is not known. */
  pageAddress: string | null;
}

export interface PlaybackEndRule {
  onPlaybackStarted?(now: number, observation: MediaObservation): void;
  episodeState(playbackEndCheck: PlaybackEndCheck): EpisodeState | null;
  episodeStateFromEndedVideo?(endedMedia: EndedMedia): EpisodeState | null;
}

// TODO: Validate
import type { PlaybackEndCheck, PlaybackEndRule } from "./endrules/playback-end-rule";

export type ObservedPlaybackStatus = "PLAYING" | "PAUSED" | "BUFFERING" | "STOPPED";

export interface MediaObservation {
  playbackStatus: ObservedPlaybackStatus;
  position: number;
  duration: number | null;
  mediaTitle: string | null;
  playbackSpeed: number;
  /** The address of the media the video plays, or missing when the video does not report one. */
  mediaId?: string | null;
}

export interface EndedMedia {
  endedAt: number;
  duration: number | null;
}

export type EpisodeState = "STILL_WATCHING" | "FINISHED" | "NEVER_STARTED";

// TODO: Validate
export class PlaybackEndDetector {
  private readonly launchedAt: number;
  private readonly playbackEndRules: PlaybackEndRule[];
  hasStartedPlaying = false;

  // TODO: Validate
  constructor(launchedAt: number, playbackEndRules: PlaybackEndRule[]) {
    this.launchedAt = launchedAt;
    this.playbackEndRules = playbackEndRules;
  }

  // TODO: Validate
  evaluate(
    now: number,
    observation: MediaObservation | null,
    lastEndedMedia: EndedMedia | null = null,
    pageAddress: string | null = null,
  ): EpisodeState {
    if (!this.hasStartedPlaying) {
      if (observation?.playbackStatus === "PLAYING") {
        this.hasStartedPlaying = true;
        for (const playbackEndRule of this.playbackEndRules) playbackEndRule.onPlaybackStarted?.(now, observation);
        return "STILL_WATCHING";
      }
      return now - this.launchedAt > 3 * 60_000 ? "NEVER_STARTED" : "STILL_WATCHING";
    }

    if (lastEndedMedia !== null) {
      for (const playbackEndRule of this.playbackEndRules) {
        const endedVideoEpisodeState = playbackEndRule.episodeStateFromEndedVideo?.(lastEndedMedia) ?? null;
        if (endedVideoEpisodeState !== null) return endedVideoEpisodeState;
      }
    }

    // Every way of detecting the end is a rule, so a poll that no rule decides keeps watching.
    const currentPlaybackEndCheck: PlaybackEndCheck = {
      observation,
      pageAddress,
    };
    for (const playbackEndRule of this.playbackEndRules) {
      const ruleEpisodeState = playbackEndRule.episodeState(currentPlaybackEndCheck);
      if (ruleEpisodeState !== null) return ruleEpisodeState;
    }
    return "STILL_WATCHING";
  }
}

// TODO: Validate
import type { LocalAppStorage } from "../data/local-app-storage";
import { type GuideChannel, type GuideVideo, nextPlayableVideo, previousPlayableVideo } from "../data/models";
import { armProfilePicker } from "../profiles/profile-picker";
import { GUIDE_PAGE_URL } from "../userscript/userscript-pages";
import type { ActivePlayback, PlaybackOutcome } from "./playback-monitor";

export interface NextVideo {
  channel: GuideChannel;
  video: GuideVideo;
}

export type VideoLaunchResult = { launched: true } | { launched: false; reason: string };

// TODO: Validate
export async function playVideoInThisTab(
  preferences: LocalAppStorage,
  activePlayback: ActivePlayback,
  videoUrl: string,
  monitorsPlayback: boolean,
): Promise<VideoLaunchResult> {
  await armProfilePicker();
  await preferences.saveActivePlayback({ ...activePlayback, isMonitoring: monitorsPlayback });
  await preferences.finishPendingWrites();
  try {
    window.location.assign(videoUrl);
  } catch (launchError) {
    await stopMonitoring(preferences);
    return { launched: false, reason: launchError instanceof Error ? launchError.message : String(launchError) };
  }
  return { launched: true };
}

// TODO: Validate
export async function stopMonitoring(preferences: LocalAppStorage): Promise<void> {
  const savedActivePlayback = preferences.activePlayback;
  if (savedActivePlayback?.isMonitoring !== true) return;
  await preferences.saveActivePlayback({ ...savedActivePlayback, isMonitoring: false });
}

// TODO: Validate
export async function returnToGuide(preferences: LocalAppStorage, playbackOutcome: PlaybackOutcome): Promise<void> {
  await stopMonitoring(preferences);
  await preferences.savePendingPlaybackOutcome({ playbackOutcome, returnedAt: Date.now() });
  await preferences.finishPendingWrites();
  window.location.assign(GUIDE_PAGE_URL);
}

// TODO: Validate
export function activePlaybackFor(
  channel: GuideChannel,
  video: GuideVideo,
  streamingSitePluginKey: string | null,
): ActivePlayback {
  return {
    channelId: channel.id,
    channelName: channel.name,
    channelVideos: channel.videos,
    playingEpisodeId: video.episodeId,
    streamingSitePluginKey,
    launchedAt: Date.now(),
    isMonitoring: true,
  };
}

// TODO: Validate
export function nextVideoInPlayedOrLatestOrder(
  endedPlayback: ActivePlayback,
  latestChannel: GuideChannel | null,
): NextVideo | null {
  const playedChannel = playedChannelOf(endedPlayback, latestChannel);
  const nextVideoInPlayedOrder = nextPlayableVideo(playedChannel, endedPlayback.playingEpisodeId);
  if (nextVideoInPlayedOrder !== null) return { channel: playedChannel, video: nextVideoInPlayedOrder };
  const nextVideoInLatestGuide =
    latestChannel === null ? null : nextPlayableVideo(latestChannel, endedPlayback.playingEpisodeId);
  if (latestChannel === null || nextVideoInLatestGuide === null) return null;
  return { channel: latestChannel, video: nextVideoInLatestGuide };
}

// TODO: Validate
/**
 * Returns the video before the ended one, in the episode order saved when the video was launched. Falls back to
 * the latest guide's order when the saved order has no video before it.
 */
export function previousVideoInPlayedOrLatestOrder(
  endedPlayback: ActivePlayback,
  latestChannel: GuideChannel | null,
): NextVideo | null {
  const playedChannel = playedChannelOf(endedPlayback, latestChannel);
  const previousVideoInPlayedOrder = previousPlayableVideo(playedChannel, endedPlayback.playingEpisodeId);
  if (previousVideoInPlayedOrder !== null) return { channel: playedChannel, video: previousVideoInPlayedOrder };
  const previousVideoInLatestGuide =
    latestChannel === null ? null : previousPlayableVideo(latestChannel, endedPlayback.playingEpisodeId);
  if (latestChannel === null || previousVideoInLatestGuide === null) return null;
  return { channel: latestChannel, video: previousVideoInLatestGuide };
}

// TODO: Validate
function playedChannelOf(endedPlayback: ActivePlayback, latestChannel: GuideChannel | null): GuideChannel {
  return {
    id: endedPlayback.channelId,
    name: endedPlayback.channelName,
    number: null,
    defaultOrder: latestChannel?.defaultOrder ?? null,
    videos: endedPlayback.channelVideos,
    imageUrl: null,
    hasMoreVideos: false,
    authorUsername: null,
  };
}

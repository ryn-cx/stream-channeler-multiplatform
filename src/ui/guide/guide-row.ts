// TODO: Validate
import { DEFAULT_MINIMUM_VIDEO_MINUTES } from "../../data/local-app-storage";
import type { GuideChannel, GuideVideo } from "../../data/models";

export interface ScheduledVideo {
  video: GuideVideo;
  startMinute: number;
  minutes: number;
}

export interface GuideRow {
  channel: GuideChannel;
  scheduledVideos: ScheduledVideo[];
  isCurrentChannelRow: boolean;
  isFavorite: boolean;
  channelStatusText: string | null;
  isLoadingMoreVideos: boolean;
}

// TODO: Validate
/**
 * Lays videos out one after another. Each video is as long as its duration, stretched to minimumVideoMinutes. When
 * textFittingMinutes is given, each video is instead exactly as long as its text needs.
 */
export function scheduleChannelVideos(
  videos: GuideVideo[],
  minimumVideoMinutes = DEFAULT_MINIMUM_VIDEO_MINUTES,
  textFittingMinutes: ((video: GuideVideo) => number) | null = null,
): ScheduledVideo[] {
  let nextStartMinute = 0;
  return videos.map((video) => {
    const videoMinutes =
      textFittingMinutes === null
        ? // Every video is at least 1 minute wide, so a video under 30 seconds still gets a cell that can be focused.
          Math.max(1, minimumVideoMinutes, Math.round((video.durationSeconds ?? 1800) / 60))
        : textFittingMinutes(video);
    const scheduledVideo = { video, startMinute: nextStartMinute, minutes: videoMinutes };
    nextStartMinute += videoMinutes;
    return scheduledVideo;
  });
}

// TODO: Validate
export function guideWindowStart(now: number): number {
  const windowStart = new Date(now);
  windowStart.setMinutes(windowStart.getMinutes() < 30 ? 0 : 30, 0, 0);
  return windowStart.getTime();
}

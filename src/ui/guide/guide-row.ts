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
export function scheduleChannelVideos(
  videos: GuideVideo[],
  minimumVideoMinutes = DEFAULT_MINIMUM_VIDEO_MINUTES,
): ScheduledVideo[] {
  let nextStartMinute = 0;
  return videos.map((video) => {
    const videoMinutes = Math.max(minimumVideoMinutes, Math.round((video.durationSeconds ?? 1800) / 60));
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

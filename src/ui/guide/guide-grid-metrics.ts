// TODO: Validate
import { zoomScale } from "../common/ui";
import type { GuideRow } from "./guide-row";

export const SLOT_MINUTES = 30;
export const LOAD_MORE_VIDEOS_MINUTES = 30;

// TODO: Validate
export class GuideGridMetrics {
  // TODO: Validate
  dp(densityIndependentPixels: number): number {
    return densityIndependentPixels * zoomScale();
  }

  // TODO: Validate
  get channelColumnWidthPx(): number {
    return this.dp(184);
  }

  // TODO: Validate
  get headerHeightPx(): number {
    return this.dp(36);
  }

  // TODO: Validate
  get pixelsPerMinute(): number {
    return this.dp(6);
  }

  // TODO: Validate
  get cellPaddingPx(): number {
    return this.dp(8);
  }

  // TODO: Validate
  get horizontalScrollMarginPx(): number {
    return this.dp(24);
  }

  // TODO: Validate
  get focusStrokeWidthPx(): number {
    return this.dp(2);
  }

  // TODO: Validate
  rowHeightPx(isCondensed: boolean): number {
    return this.dp(isCondensed ? 32 : 48);
  }

  // TODO: Validate
  trackViewportWidthPx(viewWidthPx: number): number {
    return Math.max(0, viewWidthPx - this.channelColumnWidthPx);
  }

  // TODO: Validate
  rowsViewportHeightPx(viewHeightPx: number): number {
    return Math.max(0, viewHeightPx - this.headerHeightPx);
  }
}

// TODO: Validate
export function scheduledMinutes(guideRow: GuideRow): number {
  return guideRow.scheduledVideos.reduce((totalMinutes, scheduledVideo) => totalMinutes + scheduledVideo.minutes, 0);
}

// TODO: Validate
export function isLoadMoreVideosIndex(guideRow: GuideRow, videoIndex: number): boolean {
  return guideRow.channel.hasMoreVideos && videoIndex === guideRow.scheduledVideos.length;
}

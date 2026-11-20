// TODO: Validate
import { formatChannelNumber, type GuideVideo } from "../../data/models";
import { type ImageLoader, imageHeight, imageWidth, type LoadedImage } from "../common/image-loader";
import { UiColors } from "../common/ui";
import { channelLogoNeedsLightBackground } from "./channel-logo-background";
import {
  type GuideGridMetrics,
  isLoadMoreVideosIndex,
  LOAD_MORE_VIDEOS_MINUTES,
  SLOT_MINUTES,
  scheduledMinutes,
} from "./guide-grid-metrics";
import type { GuideRow, ScheduledVideo } from "./guide-row";
import { formatSlotHeaderTime } from "./guide-time-formatting";

export interface GuideGridDrawState {
  guideRows: GuideRow[];
  windowStart: number;
  timelineMinutes: number;
  focusedRowIndex: number;
  focusedVideoIndex: number;
  scrollXPx: number;
  scrollYPx: number;
  viewWidth: number;
  viewHeight: number;
  rowHeightPx: number;
  hasFocus: boolean;
  playingEpisodeId: string | null;
  footerMessage: string | null;
  emptyMessage: string;
  isCondensed: boolean;
  showsSourceLogos: boolean;
}

interface CellRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// TODO: Validate
export class GuideGridRenderer {
  private readonly drawingContext: CanvasRenderingContext2D;
  private readonly metrics: GuideGridMetrics;
  private readonly imageLoader: ImageLoader;
  private readonly invalidate: () => void;
  private readonly channelLogoUrlToNeedsLightBackground = new Map<string, boolean>();
  private drawState!: GuideGridDrawState;

  // TODO: Validate
  constructor(
    drawingContext: CanvasRenderingContext2D,
    metrics: GuideGridMetrics,
    imageLoader: ImageLoader,
    invalidate: () => void,
  ) {
    this.drawingContext = drawingContext;
    this.metrics = metrics;
    this.imageLoader = imageLoader;
    this.invalidate = invalidate;
  }

  // TODO: Validate
  private font(sizeSp: number, isBold: boolean): string {
    return `${isBold ? "bold " : ""}${this.metrics.dp(sizeSp)}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  }

  // TODO: Validate
  /**
   * Returns how many minutes wide video's cell must be to show its title and subtitle in full, using the same fonts,
   * padding and website logo as drawVideoCell.
   */
  videoTextFittingMinutes(video: GuideVideo, isCondensed: boolean, showsSourceLogos: boolean): number {
    const canvasContext = this.drawingContext;
    canvasContext.font = this.font(14, true);
    let widestTextWidth = canvasContext.measureText(video.title ?? "").width;
    if (!isCondensed) {
      canvasContext.font = this.font(12, false);
      widestTextWidth = Math.max(widestTextWidth, canvasContext.measureText(video.subtitle).width);
    }
    const faviconWidth =
      showsSourceLogos && video.faviconUrl !== null ? this.metrics.dp(20) + this.metrics.cellPaddingPx * 0.75 : 0;
    // The extra pixel is the cell's right border.
    const cellWidth = this.metrics.cellPaddingPx * 2 + faviconWidth + widestTextWidth + 1;
    return Math.max(1, Math.ceil(cellWidth / this.metrics.pixelsPerMinute));
  }

  // TODO: Validate
  draw(drawState: GuideGridDrawState): void {
    this.drawState = drawState;
    const canvasContext = this.drawingContext;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvasContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    canvasContext.fillStyle = UiColors.BACKGROUND;
    canvasContext.fillRect(0, 0, this.drawState.viewWidth, this.drawState.viewHeight);
    if (this.drawState.guideRows.length === 0) {
      this.drawCenteredMessage(this.drawState.emptyMessage);
      return;
    }
    const firstVisibleRowIndex = Math.max(0, Math.floor(this.drawState.scrollYPx / this.drawState.rowHeightPx));
    const lastVisibleRowIndex = Math.min(
      this.drawState.guideRows.length - 1,
      Math.floor(
        (this.drawState.scrollYPx + this.metrics.rowsViewportHeightPx(this.drawState.viewHeight)) /
          this.drawState.rowHeightPx,
      ),
    );

    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.rect(
      this.metrics.channelColumnWidthPx,
      this.metrics.headerHeightPx,
      this.drawState.viewWidth - this.metrics.channelColumnWidthPx,
      this.drawState.viewHeight - this.metrics.headerHeightPx,
    );
    canvasContext.clip();
    for (let rowIndex = firstVisibleRowIndex; rowIndex <= lastVisibleRowIndex; rowIndex++) this.drawRowTrack(rowIndex);
    this.drawNowLine();
    canvasContext.restore();

    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.rect(
      0,
      this.metrics.headerHeightPx,
      this.metrics.channelColumnWidthPx,
      this.drawState.viewHeight - this.metrics.headerHeightPx,
    );
    canvasContext.clip();
    for (let rowIndex = firstVisibleRowIndex; rowIndex <= lastVisibleRowIndex; rowIndex++) this.drawRowLabel(rowIndex);
    canvasContext.restore();

    this.drawFooter();
    this.drawHeader();
  }

  // TODO: Validate
  private rowTopPx(rowIndex: number): number {
    return this.metrics.headerHeightPx + rowIndex * this.drawState.rowHeightPx - this.drawState.scrollYPx;
  }

  // TODO: Validate
  private fillRect(fillColor: string, left: number, top: number, right: number, bottom: number, fillAlpha = 1): void {
    const canvasContext = this.drawingContext;
    canvasContext.globalAlpha = fillAlpha;
    canvasContext.fillStyle = fillColor;
    canvasContext.fillRect(left, top, right - left, bottom - top);
    canvasContext.globalAlpha = 1;
  }

  // TODO: Validate
  private strokeCellOutline(cellRect: CellRect, strokeColor: string, outlineWidthPx: number, strokeAlpha = 1): void {
    const canvasContext = this.drawingContext;
    const outlineInsetPx = outlineWidthPx / 2;
    canvasContext.globalAlpha = strokeAlpha;
    canvasContext.strokeStyle = strokeColor;
    canvasContext.lineWidth = outlineWidthPx;
    canvasContext.strokeRect(
      cellRect.left + outlineInsetPx,
      cellRect.top + outlineInsetPx,
      cellRect.right - cellRect.left - outlineWidthPx,
      cellRect.bottom - cellRect.top - outlineWidthPx,
    );
    canvasContext.globalAlpha = 1;
  }

  // TODO: Validate
  private drawRowTrack(rowIndex: number): void {
    const guideRow = this.drawState.guideRows[rowIndex];
    if (guideRow === undefined) return;
    const rowTop = this.rowTopPx(rowIndex);
    const rowBottom = rowTop + this.drawState.rowHeightPx;
    this.fillRect(
      guideRow.isCurrentChannelRow ? UiColors.ACCENT_TINT : UiColors.SURFACE,
      this.metrics.channelColumnWidthPx,
      rowTop,
      this.drawState.viewWidth,
      rowBottom,
    );
    const visibleStartMinute = this.drawState.scrollXPx / this.metrics.pixelsPerMinute;
    const visibleEndMinute =
      (this.drawState.scrollXPx + this.metrics.trackViewportWidthPx(this.drawState.viewWidth)) /
      this.metrics.pixelsPerMinute;
    guideRow.scheduledVideos.forEach((scheduledVideo, videoIndex) => {
      if (scheduledVideo.startMinute + scheduledVideo.minutes < visibleStartMinute) return;
      if (scheduledVideo.startMinute > visibleEndMinute) return;
      this.drawVideoCell(rowIndex, videoIndex, scheduledVideo, rowTop);
    });
    const loadMoreVideosStartMinute = scheduledMinutes(guideRow);
    if (
      guideRow.channel.hasMoreVideos &&
      loadMoreVideosStartMinute + LOAD_MORE_VIDEOS_MINUTES >= visibleStartMinute &&
      loadMoreVideosStartMinute <= visibleEndMinute
    ) {
      this.drawLoadMoreVideosCell(rowIndex, guideRow, loadMoreVideosStartMinute, rowTop);
    }
    const dividerHeight = guideRow.isCurrentChannelRow ? this.metrics.focusStrokeWidthPx : 1;
    this.fillRect(
      guideRow.isCurrentChannelRow ? UiColors.ACCENT : UiColors.BORDER,
      this.metrics.channelColumnWidthPx,
      rowBottom - dividerHeight,
      this.drawState.viewWidth,
      rowBottom,
    );
  }

  // TODO: Validate
  private cellRectFor(startMinute: number, minutes: number, rowTop: number): CellRect {
    return {
      left: this.metrics.channelColumnWidthPx + startMinute * this.metrics.pixelsPerMinute - this.drawState.scrollXPx,
      top: rowTop,
      right:
        this.metrics.channelColumnWidthPx +
        (startMinute + minutes) * this.metrics.pixelsPerMinute -
        this.drawState.scrollXPx,
      bottom: rowTop + this.drawState.rowHeightPx,
    };
  }

  // TODO: Validate
  private drawLoadMoreVideosCell(
    rowIndex: number,
    guideRow: GuideRow,
    loadMoreVideosStartMinute: number,
    rowTop: number,
  ): void {
    const canvasContext = this.drawingContext;
    const cellRect = this.cellRectFor(loadMoreVideosStartMinute, LOAD_MORE_VIDEOS_MINUTES, rowTop);
    const isFocusedCell =
      rowIndex === this.drawState.focusedRowIndex && isLoadMoreVideosIndex(guideRow, this.drawState.focusedVideoIndex);
    const isHighlightedCell = isFocusedCell && this.drawState.hasFocus;
    this.fillRect(
      isHighlightedCell ? UiColors.ACCENT : UiColors.SURFACE,
      cellRect.left,
      cellRect.top,
      cellRect.right,
      cellRect.bottom,
    );
    if (isFocusedCell) {
      this.strokeCellOutline(
        cellRect,
        isHighlightedCell ? UiColors.TEXT : UiColors.ACCENT,
        this.metrics.focusStrokeWidthPx,
      );
    } else {
      this.fillRect(UiColors.BORDER, cellRect.right - 1, cellRect.top, cellRect.right, cellRect.bottom);
    }
    canvasContext.font = this.font(14, true);
    canvasContext.fillStyle = isHighlightedCell ? UiColors.ON_ACCENT : UiColors.ACCENT;
    const loadMoreVideosText = this.ellipsize(
      guideRow.isLoadingMoreVideos ? "Loading…" : "Load more",
      cellRect.right - cellRect.left - this.metrics.cellPaddingPx * 2,
    );
    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.rect(cellRect.left, cellRect.top, cellRect.right - cellRect.left, cellRect.bottom - cellRect.top);
    canvasContext.clip();
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    canvasContext.fillText(
      loadMoreVideosText,
      (cellRect.left + cellRect.right) / 2,
      (cellRect.top + cellRect.bottom) / 2,
    );
    canvasContext.restore();
  }

  // TODO: Validate
  private drawVideoCell(rowIndex: number, videoIndex: number, scheduledVideo: ScheduledVideo, rowTop: number): void {
    const canvasContext = this.drawingContext;
    const video = scheduledVideo.video;
    const cellRect = this.cellRectFor(scheduledVideo.startMinute, scheduledVideo.minutes, rowTop);
    const isFocusedCell =
      rowIndex === this.drawState.focusedRowIndex && videoIndex === this.drawState.focusedVideoIndex;
    const isPlaying = video.episodeId === this.drawState.playingEpisodeId;
    const cellAlpha = video.watched && !isFocusedCell ? 0.6 : 1;
    let cellFillColor: string;
    let cellFillAlpha = 1;
    let textColor: string;
    if (isFocusedCell && this.drawState.hasFocus) {
      cellFillColor = UiColors.ACCENT;
      textColor = UiColors.ON_ACCENT;
    } else if (isPlaying) {
      cellFillColor = UiColors.ACCENT;
      cellFillAlpha = 0.8;
      textColor = UiColors.ON_ACCENT;
    } else {
      cellFillColor = UiColors.SURFACE_RAISED;
      textColor = UiColors.TEXT;
    }
    this.fillRect(
      cellFillColor,
      cellRect.left,
      cellRect.top,
      cellRect.right,
      cellRect.bottom,
      cellFillAlpha * cellAlpha,
    );
    if (isFocusedCell || isPlaying) {
      const outlineWidthPx = isFocusedCell ? this.metrics.focusStrokeWidthPx : 1;
      this.strokeCellOutline(
        cellRect,
        isFocusedCell && this.drawState.hasFocus ? UiColors.TEXT : UiColors.ACCENT,
        outlineWidthPx,
        cellAlpha,
      );
    } else {
      this.fillRect(UiColors.BORDER, cellRect.right - 1, cellRect.top, cellRect.right, cellRect.bottom, cellAlpha);
    }

    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.rect(cellRect.left, cellRect.top, cellRect.right - cellRect.left, cellRect.bottom - cellRect.top);
    canvasContext.clip();
    let textLeft = Math.max(cellRect.left, this.metrics.channelColumnWidthPx) + this.metrics.cellPaddingPx;
    const faviconSizePx = this.metrics.dp(20);
    const faviconImage = this.drawState.showsSourceLogos ? this.imageLoader.cachedImage(video.faviconUrl) : null;
    if (this.drawState.showsSourceLogos && faviconImage === null && video.faviconUrl !== null) {
      this.imageLoader.loadImage(video.faviconUrl, false, () => this.invalidate());
    }
    if (faviconImage !== null && cellRect.right - textLeft > faviconSizePx * 2) {
      const faviconTop = Math.round((cellRect.top + cellRect.bottom) / 2 - faviconSizePx / 2);
      canvasContext.globalAlpha = cellAlpha;
      canvasContext.drawImage(faviconImage, Math.round(textLeft), faviconTop, faviconSizePx, faviconSizePx);
      canvasContext.globalAlpha = 1;
      textLeft += faviconSizePx + this.metrics.cellPaddingPx * 0.75;
    }
    const availableTextWidth = cellRect.right - textLeft - this.metrics.cellPaddingPx;
    if (availableTextWidth > 0) {
      const cellCenterY = (cellRect.top + cellRect.bottom) / 2;
      canvasContext.fillStyle = textColor;
      canvasContext.textAlign = "left";
      canvasContext.font = this.font(14, true);
      canvasContext.globalAlpha = cellAlpha;
      if (this.drawState.isCondensed) {
        canvasContext.textBaseline = "middle";
        canvasContext.fillText(this.ellipsize(video.title ?? "", availableTextWidth), textLeft, cellCenterY);
      } else {
        canvasContext.textBaseline = "alphabetic";
        canvasContext.fillText(
          this.ellipsize(video.title ?? "", availableTextWidth),
          textLeft,
          cellCenterY - this.metrics.dp(3),
        );
        canvasContext.font = this.font(12, false);
        canvasContext.globalAlpha = cellAlpha * 0.7;
        canvasContext.fillText(
          this.ellipsize(video.subtitle, availableTextWidth),
          textLeft,
          cellCenterY + this.metrics.dp(13),
        );
      }
      canvasContext.globalAlpha = 1;
    }
    canvasContext.restore();
  }

  // TODO: Validate
  private drawRowLabel(rowIndex: number): void {
    const canvasContext = this.drawingContext;
    const guideRow = this.drawState.guideRows[rowIndex];
    if (guideRow === undefined) return;
    const rowTop = this.rowTopPx(rowIndex);
    const isFocusedLabel = rowIndex === this.drawState.focusedRowIndex && this.drawState.focusedVideoIndex === -1;
    const isLabelHighlighted = isFocusedLabel && this.drawState.hasFocus;
    let labelFillColor: string = UiColors.SURFACE;
    if (isLabelHighlighted) {
      labelFillColor = UiColors.ACCENT;
    } else if (guideRow.isCurrentChannelRow) {
      labelFillColor = UiColors.HEADER;
    }
    this.fillRect(labelFillColor, 0, rowTop, this.metrics.channelColumnWidthPx, rowTop + this.drawState.rowHeightPx);
    this.fillRect(
      UiColors.BORDER,
      this.metrics.channelColumnWidthPx - 1,
      rowTop,
      this.metrics.channelColumnWidthPx,
      rowTop + this.drawState.rowHeightPx,
    );
    this.fillRect(
      UiColors.BORDER,
      0,
      rowTop + this.drawState.rowHeightPx - 1,
      this.metrics.channelColumnWidthPx,
      rowTop + this.drawState.rowHeightPx,
    );
    if (isFocusedLabel) {
      canvasContext.strokeStyle = this.drawState.hasFocus ? UiColors.TEXT : UiColors.ACCENT;
      canvasContext.lineWidth = this.metrics.focusStrokeWidthPx;
      canvasContext.strokeRect(1, rowTop + 1, this.metrics.channelColumnWidthPx - 2, this.drawState.rowHeightPx - 2);
    }

    const labelTextColor = isLabelHighlighted ? UiColors.ON_ACCENT : UiColors.TEXT;
    let textLeft = this.metrics.cellPaddingPx * 1.5;
    const channelNumberText = formatChannelNumber(guideRow.channel.number);
    canvasContext.textAlign = "left";
    if (channelNumberText !== null) {
      canvasContext.font = this.font(14, false);
      canvasContext.fillStyle = isLabelHighlighted ? UiColors.ON_ACCENT : UiColors.TEXT_MUTED;
      canvasContext.textBaseline = "alphabetic";
      canvasContext.fillText(channelNumberText, textLeft, rowTop + this.drawState.rowHeightPx / 2 + this.metrics.dp(5));
      textLeft += canvasContext.measureText(channelNumberText).width + this.metrics.cellPaddingPx;
    }
    const nameWidth = this.metrics.channelColumnWidthPx - textLeft - this.metrics.cellPaddingPx;
    if (nameWidth <= 0) return;

    let tagText: string | null = null;
    if (guideRow.channelStatusText !== null) {
      tagText = guideRow.channelStatusText;
    } else if (guideRow.isCurrentChannelRow) {
      tagText = "Current channel";
    }
    const channelLogoUrl = guideRow.channel.imageUrl;
    const channelLogoImage = this.imageLoader.cachedImage(channelLogoUrl);
    if (channelLogoImage === null && channelLogoUrl !== null) {
      this.imageLoader.loadImage(channelLogoUrl, true, () => this.invalidate());
    }
    if (channelLogoUrl !== null && channelLogoImage !== null) {
      this.drawChannelLogoLabel(
        guideRow,
        channelLogoUrl,
        channelLogoImage,
        textLeft,
        rowTop,
        nameWidth,
        tagText,
        isLabelHighlighted,
      );
      return;
    }
    const favoriteStarPrefix = guideRow.isFavorite ? "★ " : "";
    const channelNameText = favoriteStarPrefix + (guideRow.channel.name ?? "Untitled channel");
    canvasContext.font = this.font(14, true);
    const maximumNameLines = tagText === null && !this.drawState.isCondensed ? 2 : 1;
    const channelNameLines = this.wrapText(channelNameText, nameWidth, maximumNameLines);
    const nameLineHeight = this.metrics.dp(17);
    const smallLabelSize = this.metrics.dp(11);
    const tagHeight = tagText === null ? 0 : smallLabelSize + this.metrics.dp(2);
    const textBlockTop =
      rowTop + (this.drawState.rowHeightPx - channelNameLines.length * nameLineHeight - tagHeight) / 2;
    if (tagText !== null) {
      canvasContext.font = this.font(11, true);
      canvasContext.fillStyle = isLabelHighlighted ? UiColors.ON_ACCENT : UiColors.ACCENT;
      canvasContext.textBaseline = "alphabetic";
      canvasContext.fillText(this.ellipsize(tagText, nameWidth), textLeft, textBlockTop + smallLabelSize);
    }
    canvasContext.font = this.font(14, true);
    canvasContext.textBaseline = "middle";
    channelNameLines.forEach((channelNameLine, lineIndex) => {
      const lineCenterY = textBlockTop + tagHeight + lineIndex * nameLineHeight + nameLineHeight / 2;
      canvasContext.fillStyle = labelTextColor;
      canvasContext.fillText(channelNameLine, textLeft, lineCenterY);
      if (lineIndex === 0 && guideRow.isFavorite && !isLabelHighlighted) {
        canvasContext.fillStyle = UiColors.STAR;
        canvasContext.fillText("★", textLeft, lineCenterY);
      }
    });
  }

  // TODO: Validate
  private drawChannelLogoLabel(
    guideRow: GuideRow,
    channelLogoUrl: string,
    channelLogoImage: LoadedImage,
    labelLeft: number,
    rowTop: number,
    labelWidth: number,
    tagText: string | null,
    isLabelHighlighted: boolean,
  ): void {
    const canvasContext = this.drawingContext;
    const smallLabelSize = this.metrics.dp(11);
    const tagHeight = tagText === null ? 0 : smallLabelSize + this.metrics.dp(4);
    let needsLightBackground = this.channelLogoUrlToNeedsLightBackground.get(channelLogoUrl);
    if (needsLightBackground === undefined) {
      needsLightBackground = channelLogoNeedsLightBackground(channelLogoImage);
      this.channelLogoUrlToNeedsLightBackground.set(channelLogoUrl, needsLightBackground);
    }
    const logoPaddingXPx = needsLightBackground ? this.metrics.dp(6) : 0;
    const logoPaddingYPx = needsLightBackground ? this.metrics.dp(2) : 0;
    const favoriteStarText = "★ ";
    canvasContext.font = this.font(14, true);
    const favoriteStarWidth = guideRow.isFavorite ? canvasContext.measureText(favoriteStarText).width : 0;
    const maxLogoWidth = labelWidth - favoriteStarWidth - logoPaddingXPx * 2;
    const channelLogoWidth = imageWidth(channelLogoImage);
    const channelLogoHeight = imageHeight(channelLogoImage);
    if (maxLogoWidth <= 0 || channelLogoWidth <= 0 || channelLogoHeight <= 0) return;
    const channelLogoMaxHeightPx = this.metrics.dp(this.drawState.isCondensed ? 16 : 28);
    const logoScale = Math.min(maxLogoWidth / channelLogoWidth, channelLogoMaxHeightPx / channelLogoHeight);
    const logoWidth = channelLogoWidth * logoScale;
    const logoHeight = channelLogoHeight * logoScale;
    const logoBoxHeight = logoHeight + logoPaddingYPx * 2;
    const labelBlockTop = rowTop + (this.drawState.rowHeightPx - logoBoxHeight - tagHeight) / 2;
    if (tagText !== null) {
      canvasContext.font = this.font(11, true);
      canvasContext.fillStyle = isLabelHighlighted ? UiColors.ON_ACCENT : UiColors.ACCENT;
      canvasContext.textBaseline = "alphabetic";
      canvasContext.fillText(this.ellipsize(tagText, labelWidth), labelLeft, labelBlockTop + smallLabelSize);
    }
    const logoBoxTop = labelBlockTop + tagHeight;
    let logoBoxLeft = labelLeft;
    if (guideRow.isFavorite) {
      canvasContext.font = this.font(14, true);
      canvasContext.fillStyle = isLabelHighlighted ? UiColors.ON_ACCENT : UiColors.STAR;
      canvasContext.textBaseline = "middle";
      canvasContext.fillText(favoriteStarText, logoBoxLeft, logoBoxTop + logoBoxHeight / 2);
      logoBoxLeft += favoriteStarWidth;
    }
    if (needsLightBackground) {
      canvasContext.fillStyle = "#ffffff";
      canvasContext.beginPath();
      canvasContext.roundRect(
        logoBoxLeft,
        logoBoxTop,
        logoWidth + logoPaddingXPx * 2,
        logoBoxHeight,
        this.metrics.dp(4),
      );
      canvasContext.fill();
    }
    canvasContext.drawImage(
      channelLogoImage,
      Math.round(logoBoxLeft + logoPaddingXPx),
      Math.round(logoBoxTop + logoPaddingYPx),
      Math.round(logoWidth),
      Math.round(logoHeight),
    );
  }

  // TODO: Validate
  private drawNowLine(): void {
    const minutesSinceWindowStart = (Date.now() - this.drawState.windowStart) / 60_000;
    const nowLineX =
      this.metrics.channelColumnWidthPx +
      minutesSinceWindowStart * this.metrics.pixelsPerMinute -
      this.drawState.scrollXPx;
    if (nowLineX < this.metrics.channelColumnWidthPx || nowLineX > this.drawState.viewWidth) return;
    this.fillRect(
      UiColors.NOW_LINE,
      nowLineX,
      this.metrics.headerHeightPx,
      nowLineX + this.metrics.dp(1.5),
      this.drawState.viewHeight,
    );
  }

  // TODO: Validate
  private drawHeader(): void {
    const canvasContext = this.drawingContext;
    this.fillRect(UiColors.HEADER, 0, 0, this.drawState.viewWidth, this.metrics.headerHeightPx);
    this.fillRect(
      UiColors.BORDER,
      0,
      this.metrics.headerHeightPx - 1,
      this.drawState.viewWidth,
      this.metrics.headerHeightPx,
    );
    this.fillRect(
      UiColors.BORDER,
      this.metrics.channelColumnWidthPx - 1,
      0,
      this.metrics.channelColumnWidthPx,
      this.metrics.headerHeightPx,
    );
    const headerCenterY = this.metrics.headerHeightPx / 2;
    canvasContext.textAlign = "left";
    canvasContext.textBaseline = "middle";
    canvasContext.font = this.font(12, true);
    canvasContext.fillStyle = UiColors.TEXT;
    canvasContext.fillText("Channel", this.metrics.cellPaddingPx * 1.5, headerCenterY);
    canvasContext.font = this.font(12, false);
    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.rect(
      this.metrics.channelColumnWidthPx,
      0,
      this.drawState.viewWidth - this.metrics.channelColumnWidthPx,
      this.metrics.headerHeightPx,
    );
    canvasContext.clip();
    const slotWidthPx = SLOT_MINUTES * this.metrics.pixelsPerMinute;
    const firstVisibleSlotIndex = Math.max(0, Math.floor(this.drawState.scrollXPx / slotWidthPx));
    const lastVisibleSlotIndex = Math.min(
      this.drawState.timelineMinutes / SLOT_MINUTES - 1,
      Math.floor(
        (this.drawState.scrollXPx + this.metrics.trackViewportWidthPx(this.drawState.viewWidth)) / slotWidthPx,
      ),
    );
    for (let slotIndex = firstVisibleSlotIndex; slotIndex <= lastVisibleSlotIndex; slotIndex++) {
      const slotLeft = this.metrics.channelColumnWidthPx + slotIndex * slotWidthPx - this.drawState.scrollXPx;
      this.fillRect(UiColors.BORDER, slotLeft, 0, slotLeft + 1, this.metrics.headerHeightPx);
      canvasContext.fillStyle = UiColors.TEXT_MUTED;
      canvasContext.fillText(
        formatSlotHeaderTime(this.drawState.windowStart + slotIndex * SLOT_MINUTES * 60_000),
        slotLeft + this.metrics.cellPaddingPx,
        headerCenterY,
      );
    }
    canvasContext.restore();
  }

  // TODO: Validate
  private drawFooter(): void {
    const canvasContext = this.drawingContext;
    const footerText = this.drawState.footerMessage;
    if (footerText === null) return;
    const footerTop = this.rowTopPx(this.drawState.guideRows.length);
    if (footerTop > this.drawState.viewHeight || footerTop + this.drawState.rowHeightPx < this.metrics.headerHeightPx)
      return;
    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.rect(
      0,
      this.metrics.headerHeightPx,
      this.drawState.viewWidth,
      this.drawState.viewHeight - this.metrics.headerHeightPx,
    );
    canvasContext.clip();
    this.fillRect(UiColors.BACKGROUND, 0, footerTop, this.drawState.viewWidth, footerTop + this.drawState.rowHeightPx);
    canvasContext.font = this.font(16, false);
    canvasContext.fillStyle = UiColors.TEXT_MUTED;
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    canvasContext.fillText(footerText, this.drawState.viewWidth / 2, footerTop + this.drawState.rowHeightPx / 2);
    canvasContext.restore();
  }

  // TODO: Validate
  private drawCenteredMessage(messageText: string): void {
    const canvasContext = this.drawingContext;
    if (messageText.length === 0 || this.drawState.viewWidth === 0) return;
    canvasContext.font = this.font(16, false);
    canvasContext.fillStyle = UiColors.TEXT_MUTED;
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";
    const messageLines = this.wrapText(
      messageText,
      Math.max(1, this.drawState.viewWidth - this.metrics.dp(64)),
      Number.POSITIVE_INFINITY,
    );
    const messageLineHeight = this.metrics.dp(22);
    const messageTop = (this.drawState.viewHeight - messageLines.length * messageLineHeight) / 2;
    messageLines.forEach((messageLine, lineIndex) => {
      canvasContext.fillText(
        messageLine,
        this.drawState.viewWidth / 2,
        messageTop + lineIndex * messageLineHeight + messageLineHeight / 2,
      );
    });
  }

  // TODO: Validate
  private ellipsize(fullText: string, availableWidth: number): string {
    if (availableWidth <= 0) return "";
    const canvasContext = this.drawingContext;
    if (canvasContext.measureText(fullText).width <= availableWidth) return fullText;
    let fittingLength = 0;
    let tooLongLength = fullText.length;
    while (tooLongLength - fittingLength > 1) {
      const middleLength = Math.floor((fittingLength + tooLongLength) / 2);
      if (canvasContext.measureText(`${fullText.slice(0, middleLength)}…`).width <= availableWidth) {
        fittingLength = middleLength;
      } else {
        tooLongLength = middleLength;
      }
    }
    return fittingLength === 0 ? "" : `${fullText.slice(0, fittingLength).trimEnd()}…`;
  }

  // TODO: Validate
  private wrapText(fullText: string, availableWidth: number, maximumLines: number): string[] {
    const canvasContext = this.drawingContext;
    const wrappedLines: string[] = [];
    let currentLine = "";
    const textWords = fullText.split(/\s+/).filter((textWord) => textWord.length > 0);
    for (let wordIndex = 0; wordIndex < textWords.length; wordIndex++) {
      const textWord = textWords[wordIndex] ?? "";
      const candidateLine = currentLine.length === 0 ? textWord : `${currentLine} ${textWord}`;
      if (canvasContext.measureText(candidateLine).width <= availableWidth || currentLine.length === 0) {
        currentLine = candidateLine;
        continue;
      }
      if (wrappedLines.length + 1 >= maximumLines) {
        wrappedLines.push(this.ellipsize(`${currentLine} ${textWords.slice(wordIndex).join(" ")}`, availableWidth));
        return wrappedLines;
      }
      wrappedLines.push(currentLine);
      currentLine = textWord;
    }
    if (currentLine.length > 0) wrappedLines.push(this.ellipsize(currentLine, availableWidth));
    return wrappedLines;
  }
}

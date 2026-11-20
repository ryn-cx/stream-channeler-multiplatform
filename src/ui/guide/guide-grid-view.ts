// TODO: Validate
import type { GuideVideo } from "../../data/models";
import type { ImageLoader } from "../common/image-loader";
import type { RemoteAction } from "../common/remote-input";
import {
  GuideGridMetrics,
  isLoadMoreVideosIndex,
  LOAD_MORE_VIDEOS_MINUTES,
  SLOT_MINUTES,
  scheduledMinutes,
} from "./guide-grid-metrics";
import { GuideGridRenderer } from "./guide-grid-renderer";
import type { GuideRow, ScheduledVideo } from "./guide-row";

const MINIMUM_TIMELINE_MINUTES = 240;
const NEAR_LAST_ROW_COUNT = 20;

export interface GuideGridListener {
  onVideoFocused(guideRow: GuideRow, scheduledVideo: ScheduledVideo, windowStart: number): void;
  onChannelLabelFocused(guideRow: GuideRow): void;
  onVideoChosen(guideRow: GuideRow, scheduledVideo: ScheduledVideo): void;
  onVideoMenuRequested(guideRow: GuideRow, scheduledVideo: ScheduledVideo): void;
  onChannelLabelChosen(guideRow: GuideRow): void;
  onLoadMoreVideosFocused(guideRow: GuideRow): void;
  onLoadMoreVideosChosen(guideRow: GuideRow): void;
  onNearLastRow(): void;
}

interface ScrollAnimation {
  fromScrollX: number;
  fromScrollY: number;
  toScrollX: number;
  toScrollY: number;
  startedAt: number;
}

// TODO: Validate
export class GuideGridView {
  readonly canvasElement: HTMLCanvasElement;
  private readonly listener: GuideGridListener;
  private readonly metrics = new GuideGridMetrics();
  private readonly renderer: GuideGridRenderer;
  private guideRows: GuideRow[] = [];
  private windowStart = Date.now();
  private timelineMinutes = MINIMUM_TIMELINE_MINUTES;
  private focusedRowIndex = 0;
  private focusedVideoIndex = 0;
  private focusAnchorMinute = 0;
  private scrollXPx = 0;
  private scrollYPx = 0;
  private scrollAnimation: ScrollAnimation | null = null;
  private flingVelocityX = 0;
  private flingVelocityY = 0;
  private lastFlingFrame: number | null = null;
  private isDrawScheduled = false;
  private viewWidth = 0;
  private viewHeight = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPointerMove = 0;
  private pointerVelocityX = 0;
  private pointerVelocityY = 0;
  private isDraggingWithPointer = false;
  private hadFocusAtPointerDown = false;
  private activePointerId: number | null = null;
  private touchLongPressTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private didOpenMenuDuringPointerPress = false;
  private playingEpisodeIdValue: string | null = null;
  private footerMessageValue: string | null = null;
  private emptyMessageValue = "";
  private isCondensedValue = false;
  private showsSourceLogosValue = true;

  // TODO: Validate
  constructor(listener: GuideGridListener, imageLoader: ImageLoader) {
    this.listener = listener;
    this.canvasElement = document.createElement("canvas");
    this.canvasElement.className = "guide-grid";
    this.canvasElement.tabIndex = 0;
    const drawingContext = this.canvasElement.getContext("2d");
    if (drawingContext === null) throw new Error("This browser can't draw the guide");
    this.renderer = new GuideGridRenderer(drawingContext, this.metrics, imageLoader, () => this.invalidate());
    new ResizeObserver(() => this.onSizeChanged()).observe(this.canvasElement);
    this.canvasElement.addEventListener("focus", () => {
      this.ensureFocusedCellVisible(true);
      this.notifyFocusedCell();
      this.invalidate();
    });
    this.canvasElement.addEventListener("blur", () => this.invalidate());
    this.canvasElement.addEventListener("pointerdown", (pointerEvent) => this.onPointerDown(pointerEvent));
    this.canvasElement.addEventListener("pointermove", (pointerEvent) => this.onPointerMove(pointerEvent));
    this.canvasElement.addEventListener("pointerup", (pointerEvent) => this.onPointerUp(pointerEvent));
    this.canvasElement.addEventListener("pointercancel", () => {
      this.activePointerId = null;
      this.cancelTouchLongPress();
    });
    this.canvasElement.addEventListener("contextmenu", (mouseEvent) => {
      mouseEvent.preventDefault();
      // A touch long press can open the menu from both the long-press timer and the browser's own contextmenu event.
      if (this.didOpenMenuDuringPointerPress) return;
      this.cancelTouchLongPress();
      if (this.activePointerId !== null) this.didOpenMenuDuringPointerPress = true;
      if (this.focusCellAt(mouseEvent.offsetX, mouseEvent.offsetY)) this.openFocusedVideoMenu();
    });
    this.canvasElement.addEventListener("wheel", (wheelEvent) => this.onWheel(wheelEvent), { passive: false });
  }

  // TODO: Validate
  set playingEpisodeId(playingEpisodeId: string | null) {
    this.playingEpisodeIdValue = playingEpisodeId;
    this.invalidate();
  }

  // TODO: Validate
  set footerMessage(footerMessage: string | null) {
    this.footerMessageValue = footerMessage;
    this.clampScroll();
    this.invalidate();
  }

  // TODO: Validate
  set emptyMessage(emptyMessage: string) {
    this.emptyMessageValue = emptyMessage;
    this.invalidate();
  }

  // TODO: Validate
  set isCondensed(isCondensed: boolean) {
    if (this.isCondensedValue === isCondensed) return;
    this.isCondensedValue = isCondensed;
    this.clampScroll();
    this.invalidate();
  }

  // TODO: Validate
  set showsSourceLogos(showsSourceLogos: boolean) {
    if (this.showsSourceLogosValue === showsSourceLogos) return;
    this.showsSourceLogosValue = showsSourceLogos;
    this.invalidate();
  }

  // TODO: Validate
  videoTextFittingMinutes(video: GuideVideo, isCondensed: boolean, showsSourceLogos: boolean): number {
    return this.renderer.videoTextFittingMinutes(video, isCondensed, showsSourceLogos);
  }

  // TODO: Validate
  hasFocus(): boolean {
    return document.activeElement === this.canvasElement;
  }

  // TODO: Validate
  requestFocus(): void {
    this.canvasElement.focus({ preventScroll: true });
  }

  // TODO: Validate
  private get channelColumnWidthPx(): number {
    return this.metrics.channelColumnWidthPx;
  }

  // TODO: Validate
  private get headerHeightPx(): number {
    return this.metrics.headerHeightPx;
  }

  // TODO: Validate
  private get rowHeightPx(): number {
    return this.metrics.rowHeightPx(this.isCondensedValue);
  }

  // TODO: Validate
  private get pixelsPerMinute(): number {
    return this.metrics.pixelsPerMinute;
  }

  // TODO: Validate
  private get horizontalScrollMarginPx(): number {
    return this.metrics.horizontalScrollMarginPx;
  }

  // TODO: Validate
  setGuideRows(newGuideRows: GuideRow[], newWindowStart: number): void {
    const previouslyFocusedRow = this.guideRows[this.focusedRowIndex];
    const previouslyFocusedEpisodeId = previouslyFocusedRow?.scheduledVideos[this.focusedVideoIndex]?.video.episodeId;
    const wasLoadMoreVideosCellFocused =
      previouslyFocusedRow !== undefined && isLoadMoreVideosIndex(previouslyFocusedRow, this.focusedVideoIndex);
    this.guideRows = newGuideRows;
    this.windowStart = newWindowStart;
    const longestScheduleMinutes = Math.max(
      0,
      ...newGuideRows.map(
        (guideRow) => scheduledMinutes(guideRow) + (guideRow.channel.hasMoreVideos ? LOAD_MORE_VIDEOS_MINUTES : 0),
      ),
    );
    this.timelineMinutes =
      Math.ceil(Math.max(MINIMUM_TIMELINE_MINUTES, longestScheduleMinutes) / SLOT_MINUTES) * SLOT_MINUTES;

    if (previouslyFocusedRow !== undefined) {
      const matchingRowIndex = newGuideRows.findIndex(
        (guideRow) =>
          guideRow.channel.id === previouslyFocusedRow.channel.id &&
          guideRow.isCurrentChannelRow === previouslyFocusedRow.isCurrentChannelRow,
      );
      const matchingRow = newGuideRows[matchingRowIndex];
      if (matchingRow !== undefined) {
        this.focusedRowIndex = matchingRowIndex;
        if (this.focusedVideoIndex >= 0) {
          const matchingVideoIndex = matchingRow.scheduledVideos.findIndex(
            (scheduledVideo) => scheduledVideo.video.episodeId === previouslyFocusedEpisodeId,
          );
          if (matchingVideoIndex >= 0) {
            this.focusedVideoIndex = matchingVideoIndex;
          } else if (
            wasLoadMoreVideosCellFocused &&
            matchingRow.scheduledVideos.length <= previouslyFocusedRow.scheduledVideos.length
          ) {
            this.focusedVideoIndex = lastFocusableVideoIndex(matchingRow);
          } else {
            this.focusedVideoIndex = videoIndexAtMinute(matchingRow, this.focusAnchorMinute);
          }
        }
      }
    }
    this.focusedRowIndex = clamp(this.focusedRowIndex, 0, Math.max(0, newGuideRows.length - 1));
    const focusedRow = newGuideRows[this.focusedRowIndex];
    this.focusedVideoIndex =
      focusedRow === undefined ? 0 : clamp(this.focusedVideoIndex, -1, lastFocusableVideoIndex(focusedRow));
    this.clampScroll();
    this.invalidate();
    this.notifyFocusedCell();
  }

  // TODO: Validate
  focusEpisode(channelId: string, episodeId: string | null): void {
    const matchingRowIndex = this.guideRows.findIndex((guideRow) => guideRow.channel.id === channelId);
    const matchingRow = this.guideRows[matchingRowIndex];
    if (matchingRow === undefined) return;
    this.focusedRowIndex = matchingRowIndex;
    const matchingVideoIndex = matchingRow.scheduledVideos.findIndex(
      (scheduledVideo) => scheduledVideo.video.episodeId === episodeId,
    );
    this.focusedVideoIndex = Math.max(0, matchingVideoIndex);
    this.focusAnchorMinute = matchingRow.scheduledVideos[this.focusedVideoIndex]?.startMinute ?? 0;
    this.ensureFocusedCellVisible(false);
    this.invalidate();
    this.notifyFocusedCell();
  }

  // TODO: Validate
  openFocusedVideoMenu(): boolean {
    const focusedRow = this.guideRows[this.focusedRowIndex];
    const focusedScheduledVideo = focusedRow?.scheduledVideos[this.focusedVideoIndex];
    if (focusedRow === undefined || focusedScheduledVideo === undefined) return false;
    this.listener.onVideoMenuRequested(focusedRow, focusedScheduledVideo);
    return true;
  }

  // TODO: Validate
  invalidate(): void {
    if (this.isDrawScheduled) return;
    this.isDrawScheduled = true;
    requestAnimationFrame((frame) => this.onAnimationFrame(frame));
  }

  // TODO: Validate
  handleRemoteAction(remoteAction: RemoteAction): boolean {
    if (this.guideRows.length === 0) return false;
    switch (remoteAction) {
      case "left":
        this.moveFocusHorizontally(-1);
        return true;
      case "right":
        this.moveFocusHorizontally(1);
        return true;
      case "up":
        if (this.focusedRowIndex === 0) return false;
        this.moveFocusVertically(-1);
        return true;
      case "down":
        if (this.focusedRowIndex === this.guideRows.length - 1) {
          this.scrollToPosition(this.scrollXPx, this.maxScrollY(), true);
          this.listener.onNearLastRow();
        } else {
          this.moveFocusVertically(1);
        }
        return true;
      case "select":
        this.chooseFocusedCell();
        return true;
      case "selectHeld":
        this.openFocusedVideoMenu();
        return true;
      case "pageUp":
        this.moveFocusVertically(-this.rowsPerPage());
        return true;
      case "pageDown":
        this.moveFocusVertically(this.rowsPerPage());
        return true;
      case "timelineEarlier":
        this.pageTimeline(-1);
        return true;
      case "timelineLater":
        this.pageTimeline(1);
        return true;
      case "home":
        this.moveFocusVertically(-this.focusedRowIndex);
        return true;
      case "end":
        this.moveFocusVertically(this.guideRows.length - 1 - this.focusedRowIndex);
        return true;
      case "channel": {
        const focusedRow = this.guideRows[this.focusedRowIndex];
        if (focusedRow !== undefined) this.listener.onChannelLabelChosen(focusedRow);
        return true;
      }
      default:
        return false;
    }
  }

  // TODO: Validate
  private onSizeChanged(): void {
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.viewWidth = this.canvasElement.clientWidth;
    this.viewHeight = this.canvasElement.clientHeight;
    this.canvasElement.width = Math.round(this.viewWidth * devicePixelRatio);
    this.canvasElement.height = Math.round(this.viewHeight * devicePixelRatio);
    this.clampScroll();
    this.invalidate();
  }

  // TODO: Validate
  private onPointerDown(pointerEvent: PointerEvent): void {
    this.hadFocusAtPointerDown = this.hasFocus();
    this.cancelScrollMotion();
    this.activePointerId = pointerEvent.pointerId;
    this.canvasElement.setPointerCapture(pointerEvent.pointerId);
    this.pointerDownX = pointerEvent.offsetX;
    this.pointerDownY = pointerEvent.offsetY;
    this.lastPointerX = pointerEvent.offsetX;
    this.lastPointerY = pointerEvent.offsetY;
    this.lastPointerMove = pointerEvent.timeStamp;
    this.pointerVelocityX = 0;
    this.pointerVelocityY = 0;
    this.isDraggingWithPointer = false;
    this.didOpenMenuDuringPointerPress = false;
    this.cancelTouchLongPress();
    // Mouse users open the menu with a right click, so only touch and pen presses need a long-press timer.
    // Safari on iOS does not fire contextmenu for a long press, so the timer is the only way there.
    if (pointerEvent.pointerType !== "mouse") {
      const pressedPointerId = pointerEvent.pointerId;
      const pressedX = pointerEvent.offsetX;
      const pressedY = pointerEvent.offsetY;
      // Matches Android's default long-press timeout, which the app's GestureDetector uses to open the video menu.
      this.touchLongPressTimeoutId = setTimeout(() => {
        this.touchLongPressTimeoutId = null;
        if (this.activePointerId !== pressedPointerId || this.isDraggingWithPointer) return;
        this.didOpenMenuDuringPointerPress = true;
        if (this.focusCellAt(pressedX, pressedY)) this.openFocusedVideoMenu();
      }, 500);
    }
  }

  // TODO: Validate
  private cancelTouchLongPress(): void {
    if (this.touchLongPressTimeoutId !== null) clearTimeout(this.touchLongPressTimeoutId);
    this.touchLongPressTimeoutId = null;
  }

  // TODO: Validate
  private onPointerMove(pointerEvent: PointerEvent): void {
    if (pointerEvent.pointerId !== this.activePointerId) return;
    if (
      !this.isDraggingWithPointer &&
      Math.hypot(pointerEvent.offsetX - this.pointerDownX, pointerEvent.offsetY - this.pointerDownY) > 8
    ) {
      this.isDraggingWithPointer = true;
      this.cancelTouchLongPress();
    }
    if (!this.isDraggingWithPointer) return;
    const movedX = pointerEvent.offsetX - this.lastPointerX;
    const movedY = pointerEvent.offsetY - this.lastPointerY;
    const elapsed = Math.max(1, pointerEvent.timeStamp - this.lastPointerMove);
    this.pointerVelocityX = -movedX / elapsed;
    this.pointerVelocityY = -movedY / elapsed;
    this.lastPointerX = pointerEvent.offsetX;
    this.lastPointerY = pointerEvent.offsetY;
    this.lastPointerMove = pointerEvent.timeStamp;
    this.scrollToPosition(this.scrollXPx - movedX, this.scrollYPx - movedY, false);
  }

  // TODO: Validate
  private onPointerUp(pointerEvent: PointerEvent): void {
    if (pointerEvent.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.cancelTouchLongPress();
    if (pointerEvent.button === 2) return;
    // A press that opened the video menu is over, so lifting the finger must not also choose the video.
    if (this.didOpenMenuDuringPointerPress) {
      this.notifyIfScrolledNearEnd();
      return;
    }
    if (!this.isDraggingWithPointer) {
      this.handleTap(pointerEvent.offsetX, pointerEvent.offsetY);
      this.notifyIfScrolledNearEnd();
      return;
    }
    if (Math.hypot(this.pointerVelocityX, this.pointerVelocityY) >= 0.3) {
      this.flingVelocityX = this.pointerVelocityX;
      this.flingVelocityY = this.pointerVelocityY;
      this.lastFlingFrame = null;
      this.invalidate();
    }
    this.notifyIfScrolledNearEnd();
  }

  // TODO: Validate
  private onWheel(wheelEvent: WheelEvent): void {
    wheelEvent.preventDefault();
    this.cancelScrollMotion();
    const wheelDeltaX = wheelEvent.shiftKey ? wheelEvent.deltaY : wheelEvent.deltaX;
    const wheelDeltaY = wheelEvent.shiftKey ? 0 : wheelEvent.deltaY;
    this.scrollToPosition(this.scrollXPx + wheelDeltaX, this.scrollYPx + wheelDeltaY, false);
    this.notifyIfScrolledNearEnd();
  }

  // TODO: Validate
  private notifyIfScrolledNearEnd(): void {
    if (this.scrollYPx >= this.maxScrollY() - this.rowHeightPx * NEAR_LAST_ROW_COUNT) this.listener.onNearLastRow();
  }

  // TODO: Validate
  private moveFocusHorizontally(direction: -1 | 1): void {
    const focusedRow = this.guideRows[this.focusedRowIndex];
    if (focusedRow === undefined) return;
    const nextVideoIndex =
      this.focusedVideoIndex === -1 && direction > 0
        ? videoIndexAtMinute(focusedRow, this.visibleStartMinute())
        : clamp(this.focusedVideoIndex + direction, -1, lastFocusableVideoIndex(focusedRow));
    if (nextVideoIndex === this.focusedVideoIndex) return;
    this.focusedVideoIndex = nextVideoIndex;
    this.focusAnchorMinute =
      focusedRow.scheduledVideos[nextVideoIndex]?.startMinute ??
      (isLoadMoreVideosIndex(focusedRow, nextVideoIndex) ? scheduledMinutes(focusedRow) : this.visibleStartMinute());
    this.onFocusedCellMoved();
  }

  // TODO: Validate
  private moveFocusVertically(rowDelta: number): void {
    const nextRowIndex = clamp(this.focusedRowIndex + rowDelta, 0, this.guideRows.length - 1);
    if (nextRowIndex === this.focusedRowIndex) return;
    this.focusedRowIndex = nextRowIndex;
    const nextRow = this.guideRows[nextRowIndex];
    if (this.focusedVideoIndex >= 0 && nextRow !== undefined) {
      this.focusedVideoIndex = videoIndexAtMinute(nextRow, Math.max(this.focusAnchorMinute, this.visibleStartMinute()));
    }
    this.onFocusedCellMoved();
    if (this.focusedRowIndex >= this.guideRows.length - NEAR_LAST_ROW_COUNT) this.listener.onNearLastRow();
  }

  // TODO: Validate
  private pageTimeline(direction: -1 | 1): void {
    const pageWidthPx = Math.round(this.trackViewportWidth() * 0.8);
    const targetScrollXPx = clamp(this.scrollXPx + direction * pageWidthPx, 0, this.maxScrollX());
    this.scrollToPosition(targetScrollXPx, this.scrollYPx, true);
    const targetVisibleStartMinute = Math.round(targetScrollXPx / this.pixelsPerMinute);
    const focusedRow = this.guideRows[this.focusedRowIndex];
    if (focusedRow === undefined) return;
    this.focusedVideoIndex = videoIndexAtMinute(focusedRow, targetVisibleStartMinute);
    this.focusAnchorMinute = targetVisibleStartMinute;
    this.invalidate();
    this.notifyFocusedCell();
  }

  // TODO: Validate
  private onFocusedCellMoved(): void {
    this.ensureFocusedCellVisible(true);
    this.invalidate();
    this.notifyFocusedCell();
  }

  // TODO: Validate
  private chooseFocusedCell(): void {
    const focusedRow = this.guideRows[this.focusedRowIndex];
    if (focusedRow === undefined) return;
    if (isLoadMoreVideosIndex(focusedRow, this.focusedVideoIndex)) {
      this.listener.onLoadMoreVideosChosen(focusedRow);
      return;
    }
    const focusedScheduledVideo = focusedRow.scheduledVideos[this.focusedVideoIndex];
    if (focusedScheduledVideo === undefined) {
      this.listener.onChannelLabelChosen(focusedRow);
    } else {
      this.listener.onVideoChosen(focusedRow, focusedScheduledVideo);
    }
  }

  // TODO: Validate
  private notifyFocusedCell(): void {
    const focusedRow = this.guideRows[this.focusedRowIndex];
    if (focusedRow === undefined) return;
    if (isLoadMoreVideosIndex(focusedRow, this.focusedVideoIndex)) {
      this.listener.onLoadMoreVideosFocused(focusedRow);
      return;
    }
    const focusedScheduledVideo = focusedRow.scheduledVideos[this.focusedVideoIndex];
    if (focusedScheduledVideo === undefined) {
      this.listener.onChannelLabelFocused(focusedRow);
    } else {
      this.listener.onVideoFocused(focusedRow, focusedScheduledVideo, this.windowStart);
    }
  }

  // TODO: Validate
  private handleTap(tapX: number, tapY: number): void {
    const hadFocusBeforeTap = this.hadFocusAtPointerDown;
    const rowIndexBeforeTap = this.focusedRowIndex;
    const videoIndexBeforeTap = this.focusedVideoIndex;
    if (!this.focusCellAt(tapX, tapY)) return;
    const wasAlreadyFocused =
      hadFocusBeforeTap && this.focusedRowIndex === rowIndexBeforeTap && this.focusedVideoIndex === videoIndexBeforeTap;
    if (wasAlreadyFocused) this.chooseFocusedCell();
  }

  // TODO: Validate
  private focusCellAt(touchX: number, touchY: number): boolean {
    if (touchY < this.headerHeightPx) return false;
    const touchedRowIndex = Math.floor((touchY - this.headerHeightPx + this.scrollYPx) / this.rowHeightPx);
    const touchedRow = this.guideRows[touchedRowIndex];
    if (touchedRow === undefined) return false;
    let touchedVideoIndex: number;
    if (touchX < this.channelColumnWidthPx) {
      touchedVideoIndex = -1;
    } else {
      const touchedMinute = (touchX - this.channelColumnWidthPx + this.scrollXPx) / this.pixelsPerMinute;
      const loadMoreVideosStartMinute = scheduledMinutes(touchedRow);
      if (
        touchedRow.channel.hasMoreVideos &&
        touchedMinute >= loadMoreVideosStartMinute &&
        touchedMinute < loadMoreVideosStartMinute + LOAD_MORE_VIDEOS_MINUTES
      ) {
        touchedVideoIndex = touchedRow.scheduledVideos.length;
      } else {
        touchedVideoIndex = touchedRow.scheduledVideos.findIndex(
          (scheduledVideo) =>
            touchedMinute >= scheduledVideo.startMinute &&
            touchedMinute < scheduledVideo.startMinute + scheduledVideo.minutes,
        );
        if (touchedVideoIndex < 0) return false;
      }
    }
    this.focusedRowIndex = touchedRowIndex;
    this.focusedVideoIndex = touchedVideoIndex;
    const touchedScheduledVideo = touchedRow.scheduledVideos[touchedVideoIndex];
    if (touchedScheduledVideo !== undefined) this.focusAnchorMinute = touchedScheduledVideo.startMinute;
    if (isLoadMoreVideosIndex(touchedRow, touchedVideoIndex)) this.focusAnchorMinute = scheduledMinutes(touchedRow);
    if (!this.hasFocus()) this.requestFocus();
    this.invalidate();
    this.notifyFocusedCell();
    return true;
  }

  // TODO: Validate
  private visibleStartMinute(): number {
    return Math.floor(this.scrollXPx / this.pixelsPerMinute);
  }

  // TODO: Validate
  private rowsPerPage(): number {
    return Math.max(1, Math.floor(this.rowsViewportHeight() / this.rowHeightPx) - 1);
  }

  // TODO: Validate
  private trackViewportWidth(): number {
    return this.metrics.trackViewportWidthPx(this.viewWidth);
  }

  // TODO: Validate
  private rowsViewportHeight(): number {
    return this.metrics.rowsViewportHeightPx(this.viewHeight);
  }

  // TODO: Validate
  private contentHeight(): number {
    return this.guideRows.length * this.rowHeightPx + (this.footerMessageValue === null ? 0 : this.rowHeightPx);
  }

  // TODO: Validate
  private maxScrollX(): number {
    return Math.max(
      0,
      Math.round(this.timelineMinutes * this.pixelsPerMinute) -
        this.trackViewportWidth() +
        this.horizontalScrollMarginPx,
    );
  }

  // TODO: Validate
  private maxScrollY(): number {
    return Math.max(0, this.contentHeight() - this.rowsViewportHeight());
  }

  // TODO: Validate
  private clampScroll(): void {
    this.scrollXPx = clamp(this.scrollXPx, 0, this.maxScrollX());
    this.scrollYPx = clamp(this.scrollYPx, 0, this.maxScrollY());
  }

  // TODO: Validate
  private cancelScrollMotion(): void {
    this.scrollAnimation = null;
    this.flingVelocityX = 0;
    this.flingVelocityY = 0;
  }

  // TODO: Validate
  private scrollToPosition(targetScrollXPx: number, targetScrollYPx: number, animate: boolean): void {
    const clampedTargetXPx = clamp(targetScrollXPx, 0, this.maxScrollX());
    const clampedTargetYPx = clamp(targetScrollYPx, 0, this.maxScrollY());
    this.cancelScrollMotion();
    if (animate) {
      this.scrollAnimation = {
        fromScrollX: this.scrollXPx,
        fromScrollY: this.scrollYPx,
        toScrollX: clampedTargetXPx,
        toScrollY: clampedTargetYPx,
        startedAt: performance.now(),
      };
    } else {
      this.scrollXPx = clampedTargetXPx;
      this.scrollYPx = clampedTargetYPx;
    }
    this.invalidate();
  }

  // TODO: Validate
  private ensureFocusedCellVisible(animate: boolean): void {
    if (this.viewWidth === 0 || this.viewHeight === 0) {
      requestAnimationFrame(() => this.ensureFocusedCellVisible(false));
      return;
    }
    const baseScrollXPx = this.scrollAnimation?.toScrollX ?? this.scrollXPx;
    const baseScrollYPx = this.scrollAnimation?.toScrollY ?? this.scrollYPx;
    let targetScrollYPx = baseScrollYPx;
    const focusedRowTopPx = this.focusedRowIndex * this.rowHeightPx;
    if (focusedRowTopPx < targetScrollYPx) {
      targetScrollYPx = focusedRowTopPx;
    } else if (focusedRowTopPx + this.rowHeightPx > targetScrollYPx + this.rowsViewportHeight()) {
      targetScrollYPx = focusedRowTopPx + this.rowHeightPx - this.rowsViewportHeight();
    }
    let targetScrollXPx = baseScrollXPx;
    const focusedRow = this.guideRows[this.focusedRowIndex];
    const focusedScheduledVideo = focusedRow?.scheduledVideos[this.focusedVideoIndex];
    let focusedCellStartMinute: number | null = null;
    let focusedCellMinutes = 0;
    if (focusedScheduledVideo !== undefined) {
      focusedCellStartMinute = focusedScheduledVideo.startMinute;
      focusedCellMinutes = focusedScheduledVideo.minutes;
    } else if (focusedRow !== undefined && isLoadMoreVideosIndex(focusedRow, this.focusedVideoIndex)) {
      focusedCellStartMinute = scheduledMinutes(focusedRow);
      focusedCellMinutes = LOAD_MORE_VIDEOS_MINUTES;
    }
    if (focusedCellStartMinute !== null) {
      const videoLeftPx = Math.round(focusedCellStartMinute * this.pixelsPerMinute);
      const videoRightPx = Math.round((focusedCellStartMinute + focusedCellMinutes) * this.pixelsPerMinute);
      if (videoLeftPx < targetScrollXPx) {
        targetScrollXPx = videoLeftPx - this.horizontalScrollMarginPx;
      } else if (videoRightPx > targetScrollXPx + this.trackViewportWidth()) {
        targetScrollXPx = Math.min(
          videoLeftPx - this.horizontalScrollMarginPx,
          videoRightPx - this.trackViewportWidth() + this.horizontalScrollMarginPx,
        );
      }
    }
    if (targetScrollXPx !== baseScrollXPx || targetScrollYPx !== baseScrollYPx) {
      this.scrollToPosition(targetScrollXPx, targetScrollYPx, animate);
    }
  }

  // TODO: Validate
  private onAnimationFrame(frame: number): void {
    this.isDrawScheduled = false;
    let isStillMoving = false;
    const scrollAnimation = this.scrollAnimation;
    if (scrollAnimation !== null) {
      const animationProgress = Math.min(1, (frame - scrollAnimation.startedAt) / 180);
      const easedProgress = 1 - (1 - animationProgress) ** 2;
      this.scrollXPx =
        scrollAnimation.fromScrollX + (scrollAnimation.toScrollX - scrollAnimation.fromScrollX) * easedProgress;
      this.scrollYPx =
        scrollAnimation.fromScrollY + (scrollAnimation.toScrollY - scrollAnimation.fromScrollY) * easedProgress;
      if (animationProgress >= 1) {
        this.scrollAnimation = null;
      } else {
        isStillMoving = true;
      }
    } else if (this.flingVelocityX !== 0 || this.flingVelocityY !== 0) {
      const elapsed = this.lastFlingFrame === null ? 16 : frame - this.lastFlingFrame;
      this.lastFlingFrame = frame;
      this.scrollXPx = clamp(this.scrollXPx + this.flingVelocityX * elapsed, 0, this.maxScrollX());
      this.scrollYPx = clamp(this.scrollYPx + this.flingVelocityY * elapsed, 0, this.maxScrollY());
      const frictionFactor = 0.95 ** (elapsed / 16);
      this.flingVelocityX *= frictionFactor;
      this.flingVelocityY *= frictionFactor;
      if (Math.hypot(this.flingVelocityX, this.flingVelocityY) < 0.02) {
        this.flingVelocityX = 0;
        this.flingVelocityY = 0;
        this.notifyIfScrolledNearEnd();
      } else {
        isStillMoving = true;
      }
    }
    this.draw();
    if (isStillMoving) this.invalidate();
  }

  // TODO: Validate
  private draw(): void {
    this.renderer.draw({
      guideRows: this.guideRows,
      windowStart: this.windowStart,
      timelineMinutes: this.timelineMinutes,
      focusedRowIndex: this.focusedRowIndex,
      focusedVideoIndex: this.focusedVideoIndex,
      scrollXPx: this.scrollXPx,
      scrollYPx: this.scrollYPx,
      viewWidth: this.viewWidth,
      viewHeight: this.viewHeight,
      rowHeightPx: this.rowHeightPx,
      hasFocus: this.hasFocus(),
      playingEpisodeId: this.playingEpisodeIdValue,
      footerMessage: this.footerMessageValue,
      emptyMessage: this.emptyMessageValue,
      isCondensed: this.isCondensedValue,
      showsSourceLogos: this.showsSourceLogosValue,
    });
  }
}

// TODO: Validate
function clamp(clampedValue: number, minimumValue: number, maximumValue: number): number {
  return Math.min(Math.max(clampedValue, minimumValue), Math.max(minimumValue, maximumValue));
}

// TODO: Validate
function videoIndexAtMinute(guideRow: GuideRow, minute: number): number {
  const scheduledVideos = guideRow.scheduledVideos;
  if (scheduledVideos.length === 0) return -1;
  const coveringVideoIndex = scheduledVideos.findIndex(
    (scheduledVideo) => minute < scheduledVideo.startMinute + scheduledVideo.minutes,
  );
  return coveringVideoIndex >= 0 ? coveringVideoIndex : scheduledVideos.length - 1;
}

// TODO: Validate
function lastFocusableVideoIndex(guideRow: GuideRow): number {
  return guideRow.channel.hasMoreVideos ? guideRow.scheduledVideos.length : guideRow.scheduledVideos.length - 1;
}

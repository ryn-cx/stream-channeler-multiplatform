// TODO: Validate
const OVERLAY_STYLE = `
  :host { all: initial; }
  .stream-channeler-overlay-message {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483647;
    max-width: 40vw;
    padding: 10px 16px;
    border: 1px solid #14b8a6;
    border-radius: 8px;
    background: #171717;
    color: #fafafa;
    font: 16px system-ui, sans-serif;
    white-space: pre-line;
    pointer-events: none;
  }
  .stream-channeler-overlay-message.bottom-left {
    right: auto;
    left: 24px;
  }
  .stream-channeler-overlay-message.takes-taps {
    pointer-events: auto;
    cursor: pointer;
  }
`;

// TODO: Validate
export class StatusMessageOverlay {
  private readonly overlayHost: HTMLElement;
  private readonly overlayMessage: HTMLDivElement;
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isShown = false;
  private onMessageTapped: (() => void) | null = null;

  // TODO: Validate
  /** overlayCorner lets two overlays show at once on the same page without covering each other. */
  constructor(overlayCorner: "bottom-right" | "bottom-left" = "bottom-right") {
    this.overlayHost = document.createElement("stream-channeler-overlay");
    const overlayShadowRoot = this.overlayHost.attachShadow({ mode: "closed" });
    const overlayStyle = document.createElement("style");
    overlayStyle.textContent = OVERLAY_STYLE;
    this.overlayMessage = document.createElement("div");
    this.overlayMessage.className = `stream-channeler-overlay-message ${overlayCorner}`;
    overlayShadowRoot.append(overlayStyle, this.overlayMessage);
    this.overlayMessage.addEventListener("click", (clickEvent) => {
      if (this.onMessageTapped === null) return;
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      this.onMessageTapped();
    });
    document.addEventListener("fullscreenchange", () => {
      if (this.isShown) this.attachToVisibleLayer();
    });
  }

  // TODO: Validate
  /**
   * The instruction for cancelling a message that was shown with an on-tap callback. With a keyboard or remote, the
   * viewer presses Back. On a touch screen without a mouse, the viewer taps the message.
   */
  get cancelInstructionForThisDevice(): string {
    const isTouchOnlyDevice = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;
    return isTouchOnlyDevice ? "Tap here to cancel." : "Press Back to cancel.";
  }

  // TODO: Validate
  /**
   * Shows `messageText`, replacing any message already shown, and hides it after `shownFor`. If
   * `onMessageTapped` is given, the message takes clicks and taps and calls it. Otherwise, clicks pass through to the
   * page below.
   */
  show(messageText: string, shownFor: number, onMessageTapped: (() => void) | null = null): void {
    this.showUntilHidden(messageText, onMessageTapped);
    this.hideTimeoutId = setTimeout(() => this.hide(), shownFor);
  }

  // TODO: Validate
  /** Shows `messageText` like show, but keeps it shown until hide is called. */
  showUntilHidden(messageText: string, onMessageTapped: (() => void) | null = null): void {
    this.overlayMessage.textContent = messageText;
    this.onMessageTapped = onMessageTapped;
    this.overlayMessage.classList.toggle("takes-taps", onMessageTapped !== null);
    this.isShown = true;
    this.attachToVisibleLayer();
    if (this.hideTimeoutId !== null) clearTimeout(this.hideTimeoutId);
    this.hideTimeoutId = null;
  }

  // TODO: Validate
  updateMessageIfShown(messageText: string): void {
    if (this.isShown) this.overlayMessage.textContent = messageText;
  }

  // TODO: Validate
  hide(): void {
    this.isShown = false;
    this.onMessageTapped = null;
    if (this.hideTimeoutId !== null) clearTimeout(this.hideTimeoutId);
    this.hideTimeoutId = null;
    this.overlayHost.remove();
  }

  // TODO: Validate
  private attachToVisibleLayer(): void {
    const visibleLayer = document.fullscreenElement ?? document.documentElement;
    if (this.overlayHost.parentElement !== visibleLayer) visibleLayer.appendChild(this.overlayHost);
  }
}

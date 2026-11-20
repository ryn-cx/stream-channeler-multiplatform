// TODO: Validate

const PLAYER_PAGE_OVERLAY_STYLE = `
  :host { all: initial; }
  .player-page-overlay {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 2147483647;
    max-width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    padding: 12px 16px;
    border: 1px solid #14b8a6;
    border-radius: 8px;
    background: rgba(23, 23, 23, 0.92);
    color: #fafafa;
    font: 13px system-ui, sans-serif;
    transition: opacity 200ms ease;
  }
  .player-page-overlay.is-faded-out {
    opacity: 0;
    pointer-events: none;
  }
  .player-page-overlay-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .player-page-overlay-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .player-page-overlay-control {
    padding: 6px 10px;
    border: 1px solid #303030;
    border-radius: 6px;
    background: #222222;
    color: #fafafa;
    font: inherit;
    cursor: pointer;
  }
  .player-page-overlay-control:hover,
  .player-page-overlay-control:focus-visible {
    border-color: #14b8a6;
    background: #14b8a6;
    color: #042f2e;
  }
  .player-page-overlay-details {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 12px;
    margin: 0;
  }
  .player-page-overlay-details dt {
    color: #a3a3a3;
  }
  .player-page-overlay-details dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
`;

export interface PlayerPageControl {
  /** The button's text, or a function that returns it for a button whose text changes, such as an on/off switch. */
  label: string | (() => string);
  onSelected: () => void;
}

export interface PlayerPageDetail {
  label: string;
  value: string;
}

// TODO: Validate
/**
 * A panel over the player page that shows debug details about the video being watched, with controls such as
 * returning to the guide. It shows while the mouse moves and fades out a few seconds after the mouse stops.
 */
export class PlayerPageOverlay {
  private readonly overlayHost: HTMLElement;
  private readonly overlayPanel: HTMLDivElement;
  private readonly overlayDetailsList: HTMLDListElement;
  private readonly overlayControlButtons = new Map<PlayerPageControl, HTMLButtonElement>();
  private readonly readDetails: () => PlayerPageDetail[];
  private readonly isOverlayEnabled: () => boolean;
  private readonly isOverlayAlwaysShown: () => boolean;
  private hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isShown = false;
  private isMouseOverOverlay = false;
  // TODO: Validate
  private readonly onMouseMove = () => this.showForAWhile();
  // TODO: Validate
  private readonly onFullscreenChange = () => {
    if (this.isShown) this.attachToVisibleLayer();
  };

  // TODO: Validate
  /**
   * @param readDetails returns the debug details to show. It is read again on every refresh while the overlay shows.
   * @param isOverlayEnabled whether the viewer has the overlay turned on. It is checked on every mouse move.
   */
  constructor(
    overlayControls: PlayerPageControl[],
    readDetails: () => PlayerPageDetail[],
    isOverlayEnabled: () => boolean,
    isOverlayAlwaysShown: () => boolean,
  ) {
    this.readDetails = readDetails;
    this.isOverlayEnabled = isOverlayEnabled;
    this.isOverlayAlwaysShown = isOverlayAlwaysShown;
    this.overlayHost = document.createElement("stream-channeler-player-overlay");
    const overlayShadowRoot = this.overlayHost.attachShadow({ mode: "closed" });
    const overlayStyle = document.createElement("style");
    overlayStyle.textContent = PLAYER_PAGE_OVERLAY_STYLE;
    const overlayPanel = document.createElement("div");
    overlayPanel.className = "player-page-overlay is-faded-out";
    this.overlayPanel = overlayPanel;
    const overlayTitle = document.createElement("p");
    overlayTitle.className = "player-page-overlay-title";
    overlayTitle.textContent = "Stream Channeler";
    const overlayControlsRow = document.createElement("div");
    overlayControlsRow.className = "player-page-overlay-controls";
    for (const overlayControl of overlayControls) {
      const overlayControlButton = document.createElement("button");
      overlayControlButton.type = "button";
      overlayControlButton.className = "player-page-overlay-control";
      overlayControlButton.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        overlayControl.onSelected();
        this.renderDetails();
      });
      this.overlayControlButtons.set(overlayControl, overlayControlButton);
      overlayControlsRow.append(overlayControlButton);
    }
    this.overlayDetailsList = document.createElement("dl");
    this.overlayDetailsList.className = "player-page-overlay-details";
    overlayPanel.append(overlayTitle, overlayControlsRow, this.overlayDetailsList);
    // The page under the overlay must not see the overlay's clicks. YouTube, for one, pauses on a click on its player.
    for (const swallowedEventType of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "dblclick"]) {
      overlayPanel.addEventListener(swallowedEventType, (swallowedEvent) => swallowedEvent.stopPropagation());
    }
    // The overlay stays open while the mouse is over it, and starts fading once the mouse leaves it.
    overlayPanel.addEventListener("mouseenter", () => {
      this.isMouseOverOverlay = true;
    });
    overlayPanel.addEventListener("mouseleave", () => {
      this.isMouseOverOverlay = false;
      this.showForAWhile();
    });
    overlayShadowRoot.append(overlayStyle, overlayPanel);
  }

  // TODO: Validate
  start(): void {
    window.addEventListener("mousemove", this.onMouseMove, { capture: true, passive: true });
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
  }

  // TODO: Validate
  stop(): void {
    window.removeEventListener("mousemove", this.onMouseMove, { capture: true });
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    this.hide();
    this.overlayHost.remove();
  }

  // TODO: Validate
  /** Shows the latest debug details if the overlay is showing. */
  refresh(): void {
    // The always-shown switch can change in another tab, so it is checked on every refresh.
    if (this.isOverlayAlwaysShown()) {
      this.show();
    } else if (this.isShown && this.hideTimeoutId === null && !this.isMouseOverOverlay) {
      this.hide();
    }
    if (this.isShown) this.renderDetails();
  }

  // TODO: Validate
  private showForAWhile(): void {
    if (this.isOverlayAlwaysShown()) return;
    if (!this.isOverlayEnabled()) {
      this.hide();
      return;
    }
    this.show();
    if (this.hideTimeoutId !== null) clearTimeout(this.hideTimeoutId);
    // The overlay starts fading out this long after the mouse last moved.
    this.hideTimeoutId = setTimeout(() => {
      this.hideTimeoutId = null;
      if (!this.isMouseOverOverlay) this.hide();
    }, 1_500);
  }

  // TODO: Validate
  private show(): void {
    if (this.isShown) return;
    this.isShown = true;
    this.renderDetails();
    this.attachToVisibleLayer();
    this.overlayPanel.classList.remove("is-faded-out");
  }

  // TODO: Validate
  /** Fades the overlay out. It stays on the page while faded out, so that it can fade in again. */
  private hide(): void {
    this.isShown = false;
    this.isMouseOverOverlay = false;
    if (this.hideTimeoutId !== null) clearTimeout(this.hideTimeoutId);
    this.hideTimeoutId = null;
    this.overlayPanel.classList.add("is-faded-out");
  }

  // TODO: Validate
  private renderDetails(): void {
    for (const [overlayControl, overlayControlButton] of this.overlayControlButtons) {
      overlayControlButton.textContent =
        typeof overlayControl.label === "string" ? overlayControl.label : overlayControl.label();
    }
    const detailElements = this.readDetails().flatMap((playerPageDetail) => {
      const detailLabelElement = document.createElement("dt");
      detailLabelElement.textContent = playerPageDetail.label;
      const detailValueElement = document.createElement("dd");
      detailValueElement.textContent = playerPageDetail.value;
      return [detailLabelElement, detailValueElement];
    });
    this.overlayDetailsList.replaceChildren(...detailElements);
  }

  // TODO: Validate
  private attachToVisibleLayer(): void {
    const visibleLayer = document.fullscreenElement ?? document.documentElement;
    if (this.overlayHost.parentElement !== visibleLayer) visibleLayer.appendChild(this.overlayHost);
  }
}

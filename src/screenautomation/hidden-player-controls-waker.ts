// TODO: Validate
import { findFirstVisibleElement } from "./visible-elements";

// TODO: Validate
/**
 * Shows a site's player controls without the viewer seeing them, so that buttons the site only builds while its
 * controls show can be found. Peacock, for one, only puts its Skip Intro button on the page while the mouse moves over
 * the player.
 *
 * Waking the controls makes the controls overlay transparent and sends it a mouse move. The site then builds its
 * buttons, which can be clicked even though they cannot be seen. The overlay stays transparent until the site hides its
 * controls again.
 */
export class HiddenPlayerControlsWaker {
  private readonly controlsOverlaySelector: string;
  private readonly isControlsOverlayShowing: (controlsOverlay: HTMLElement) => boolean;
  private overlayHidingStyle: HTMLStyleElement | null = null;
  private lastWokenAt = 0;

  // TODO: Validate
  constructor(controlsOverlaySelector: string, isControlsOverlayShowing: (controlsOverlay: HTMLElement) => boolean) {
    this.controlsOverlaySelector = controlsOverlaySelector;
    this.isControlsOverlayShowing = isControlsOverlayShowing;
  }

  // TODO: Validate
  /**
   * Returns the element matching elementSelector while the controls are awake, or null otherwise. When the controls
   * are asleep, this wakes them at most once every 10 seconds, so the element can be found on a later call.
   */
  findWhileAwake(elementSelector: string): HTMLElement | null {
    if (document.visibilityState === "hidden") return null;
    // The woken controls are transparent, so the element is found without checking that it can be seen.
    if (this.overlayHidingStyle !== null) return document.querySelector<HTMLElement>(elementSelector);
    const controlsOverlay = document.querySelector<HTMLElement>(this.controlsOverlaySelector);
    if (controlsOverlay === null) return null;
    // The viewer's own mouse showed the controls, so the element can be found as it is.
    if (this.isControlsOverlayShowing(controlsOverlay)) return findFirstVisibleElement(document, elementSelector);
    const now = Date.now();
    if (now - this.lastWokenAt < 10_000) return null;
    this.lastWokenAt = now;
    this.wakeHidden(controlsOverlay);
    return null;
  }

  // TODO: Validate
  private wakeHidden(controlsOverlay: HTMLElement): void {
    const overlayHidingStyle = document.createElement("style");
    overlayHidingStyle.textContent = `${this.controlsOverlaySelector} { opacity: 0 !important; cursor: none !important; }`;
    document.head.append(overlayHidingStyle);
    this.overlayHidingStyle = overlayHidingStyle;
    const overlayBounds = controlsOverlay.getBoundingClientRect();
    controlsOverlay.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: overlayBounds.left + overlayBounds.width / 2,
        clientY: overlayBounds.top + overlayBounds.height / 2,
      }),
    );
    // The style is removed by its own timer, not by findWhileAwake, so the controls do not stay transparent if the
    // player page stops looking for buttons while they are awake.
    const overlayCheckIntervalId = setInterval(() => {
      if (controlsOverlay.isConnected && this.isControlsOverlayShowing(controlsOverlay)) return;
      clearInterval(overlayCheckIntervalId);
      overlayHidingStyle.remove();
      this.overlayHidingStyle = null;
    }, 250);
  }
}

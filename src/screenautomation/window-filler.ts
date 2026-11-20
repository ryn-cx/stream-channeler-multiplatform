// TODO: Validate

/**
 * The selector that a site's fill-window style starts each rule with. The style only applies while this attribute is on
 * the page's root element, so removing the attribute puts the page back the way the site laid it out.
 */
export const FILLS_WINDOW_SELECTOR = "html[data-stream-channeler-fills-window]";
const FILLS_WINDOW_ATTRIBUTE = "data-stream-channeler-fills-window";

/**
 * CSS for a player that a site builds inside a web component's open shadow root. The page's own style cannot reach
 * into a shadow root, so this style is added inside it while the window is filled.
 */
export interface ShadowRootFillStyle {
  /** Selects the web component whose shadow root holds the player. */
  shadowHostSelector: string;
  /** The CSS added inside the shadow root. It needs no FILLS_WINDOW_SELECTOR, because it is removed on restore. */
  style: string;
}

/** The CSS that makes a site's video fill the whole browser window. */
export interface FillWindowStyle {
  /** The CSS added to the page. Each rule starts with FILLS_WINDOW_SELECTOR. */
  pageStyle: string;
  /** Extra CSS for a site whose player sits inside a web component's shadow root. */
  shadowRootStyle?: ShadowRootFillStyle;
}

// TODO: Validate
/**
 * Makes a site's video fill the whole browser window by adding the site's fill-window style to the page. This is not
 * the browser's full screen mode, so the browser keeps its own window size and does not ask the viewer anything.
 */
export class WindowFiller {
  private readonly fillWindowStyle: HTMLStyleElement;
  private readonly shadowHostSelector: string | null;
  private readonly shadowRootFillStyle: HTMLStyleElement | null;
  private isFillingWindow = false;

  // TODO: Validate
  constructor(siteFillWindowStyle: FillWindowStyle) {
    this.fillWindowStyle = document.createElement("style");
    this.fillWindowStyle.textContent = siteFillWindowStyle.pageStyle;
    const shadowRootFillStyle = siteFillWindowStyle.shadowRootStyle;
    this.shadowHostSelector = shadowRootFillStyle?.shadowHostSelector ?? null;
    if (shadowRootFillStyle === undefined) {
      this.shadowRootFillStyle = null;
    } else {
      this.shadowRootFillStyle = document.createElement("style");
      this.shadowRootFillStyle.textContent = shadowRootFillStyle.style;
    }
  }

  // TODO: Validate
  get isFilling(): boolean {
    return this.isFillingWindow;
  }

  // TODO: Validate
  fill(): void {
    this.isFillingWindow = true;
    (document.head ?? document.documentElement).append(this.fillWindowStyle);
    document.documentElement.setAttribute(FILLS_WINDOW_ATTRIBUTE, "");
    this.relayOutPlayer();
  }

  // TODO: Validate
  restore(): void {
    if (!this.isFillingWindow) return;
    this.isFillingWindow = false;
    document.documentElement.removeAttribute(FILLS_WINDOW_ATTRIBUTE);
    this.fillWindowStyle.remove();
    this.shadowRootFillStyle?.remove();
    this.relayOutPlayer();
  }

  // TODO: Validate
  /**
   * Asks the site's player to measure itself again. Players such as YouTube's size their controls from the player's
   * size, and they only measure it again when the window is resized.
   */
  relayOutPlayer(): void {
    // The window is filled as soon as the player page starts, which is often before the site builds its web component.
    // The player page calls this again when a new video appears, so the shadow root style is added then.
    if (this.isFillingWindow) this.addShadowRootFillStyle();
    window.dispatchEvent(new Event("resize"));
  }

  // TODO: Validate
  private addShadowRootFillStyle(): void {
    if (this.shadowHostSelector === null || this.shadowRootFillStyle === null) return;
    const playerShadowRoot = document.querySelector(this.shadowHostSelector)?.shadowRoot ?? null;
    if (playerShadowRoot === null || this.shadowRootFillStyle.parentNode === playerShadowRoot) return;
    playerShadowRoot.append(this.shadowRootFillStyle);
  }
}

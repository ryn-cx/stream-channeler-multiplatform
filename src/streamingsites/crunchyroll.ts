import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { findPinDigitInputs, findProfileButtonsInside } from "../profiles/streaming-profile-screen";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import { FILLS_WINDOW_SELECTOR } from "../screenautomation/window-filler";
import type { StreamingSite } from "./streaming-site";

// This string was entirely AI generated.
const CRUNCHYROLL_FILL_WINDOW_STYLE = `
  /*
   * #player-container holds Crunchyroll's video and its controls, including the skip buttons. It is pinned over the
   * whole window. The rest of the page is hidden with visibility, which the player container opts back out of, so that
   * nothing else on the page can draw over the pinned player.
   */
  ${FILLS_WINDOW_SELECTOR},
  ${FILLS_WINDOW_SELECTOR} body {
    overflow: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} #content {
    visibility: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} #player-container {
    visibility: visible !important;
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 2147483000 !important;
    background: #000 !important;
  }
  ${FILLS_WINDOW_SELECTOR} #player-container video {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
  }
`;

export const crunchyrollSite: StreamingSite = {
  pluginKey: "Crunchyroll",
  domains: ["crunchyroll.com"],
  faviconUrl: "https://www.crunchyroll.com/build/assets/img/favicons/favicon-v2-32x32.png",
  // Works with "Autoplay Next" enabled or disabled.
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  skipIntroButton: { find: () => findSkipButton("Skip Intro") },
  skipRecapButton: { find: () => findSkipButton("Skip") },
  skipCreditsButton: { find: () => findSkipButton("Skip Credits") },
  skipPreviewButton: { find: () => findSkipButton("Skip Preview") },
  fillWindowStyle: { pageStyle: CRUNCHYROLL_FILL_WINDOW_STYLE },
  profileButtons: () => findProfileButtonsInside('button[data-t="profile-button"]', '[data-t="profile-name"]'),
  pinEntry: () => findPinDigitInputs('[data-t="pin-digits-row"] input'),
};

function findSkipButton(skipButtonAriaLabel: string): HTMLElement | null {
  return findFirstVisibleElement(document, `button[aria-label="${skipButtonAriaLabel}"][aria-hidden="false"]`);
}

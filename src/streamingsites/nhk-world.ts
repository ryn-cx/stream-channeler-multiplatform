import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { FILLS_WINDOW_SELECTOR } from "../screenautomation/window-filler";
import type { StreamingSite } from "./streaming-site";

// This string was entirely AI generated.
const NHK_WORLD_FILL_WINDOW_STYLE = `
  /*
   * NHK World plays the episode in an iframe, .world-player-iframe, inside the episode page's hero section. The iframe
   * is pinned over the whole window, and the player inside it fills the iframe. The rest of the page is hidden with
   * visibility, which the iframe opts back out of, so that nothing else on the page can draw over it.
   */
  ${FILLS_WINDOW_SELECTOR},
  ${FILLS_WINDOW_SELECTOR} body {
    overflow: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} body {
    visibility: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} .world-player-iframe {
    visibility: visible !important;
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    border: 0 !important;
    z-index: 2147483000 !important;
    background: #000 !important;
  }
`;

export const nhkWorldSite: StreamingSite = {
  pluginKey: "NHK World",
  domains: ["nhk.or.jp"],
  faviconUrl: "https://www3.nhk.or.jp/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  fillWindowStyle: { pageStyle: NHK_WORLD_FILL_WINDOW_STYLE },
};

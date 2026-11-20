import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import { FILLS_WINDOW_SELECTOR } from "../screenautomation/window-filler";
import type { StreamingSite } from "./streaming-site";

// This string was entirely AI generated.
const TUBI_FILL_WINDOW_STYLE = `
  /*
   * Tubi's classes are generated names, so the player is found by its video, video[data-id="videoPlayerComponent"].
   */
  /*
   * The video sits in div[data-id="hls"] with the captions and ads. That sits in a wrapper whose parent also holds
   * Tubi's player controls as a sibling of the wrapper. So that parent is pinned over the whole window, and the
   * wrapper, the hls div and the video inside it fill it.
   */
  /*
   * The rest of the page is not hidden. Tubi's ad-blocker check sees a hidden page as an ad blocker and removes the
   * player, so the player is only pinned on top of the page.
   */
  ${FILLS_WINDOW_SELECTOR}:has(video[data-id="videoPlayerComponent"]),
  ${FILLS_WINDOW_SELECTOR}:has(video[data-id="videoPlayerComponent"]) body {
    overflow: hidden !important;
  }
  /*
   * A transform, filter or contain on any of the player's ancestors pins the player to that ancestor instead of the
   * window, and a low z-index on an ancestor layers the player below the rest of the page. Both are undone on every
   * ancestor of the pinned player, so the pinned player covers the window and draws over everything else. The elements
   * inside the pinned player are left alone, so the video does not draw over the controls.
   */
  ${FILLS_WINDOW_SELECTOR} :has(div > div > div[data-id="hls"] > video[data-id="videoPlayerComponent"]) {
    transform: none !important;
    filter: none !important;
    backdrop-filter: none !important;
    perspective: none !important;
    contain: none !important;
    will-change: auto !important;
    isolation: auto !important;
    z-index: 2147483000 !important;
  }
  ${FILLS_WINDOW_SELECTOR} div:has(> div > div[data-id="hls"] > video[data-id="videoPlayerComponent"]) {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    z-index: 2147483000 !important;
    background: #000 !important;
  }
  ${FILLS_WINDOW_SELECTOR} div:has(> div[data-id="hls"] > video[data-id="videoPlayerComponent"]),
  ${FILLS_WINDOW_SELECTOR} div[data-id="hls"]:has(> video[data-id="videoPlayerComponent"]),
  ${FILLS_WINDOW_SELECTOR} video[data-id="videoPlayerComponent"] {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
  }
`;

export const tubiSite: StreamingSite = {
  pluginKey: "Tubi",
  domains: ["tubitv.com"],
  faviconUrl: "https://tubitv.com/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, '[role="toolbar"] .web-play-button__button'),
  },
  fillWindowStyle: { pageStyle: TUBI_FILL_WINDOW_STYLE },
};

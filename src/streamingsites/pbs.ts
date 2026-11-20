import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import { FILLS_WINDOW_SELECTOR } from "../screenautomation/window-filler";
import type { StreamingSite } from "./streaming-site";

// This string was entirely AI generated.
const PBS_FILL_WINDOW_STYLE = `
  /*
   * PBS plays the episode in an iframe from player.pbs.org, iframe[data-testid="video-player"], inside the video page's
   * player container. The iframe is pinned over the whole window, and the player inside it fills the iframe. The rest
   * of the page is hidden with visibility, which the iframe opts back out of, so that nothing else on the page can
   * draw over it.
   */
  ${FILLS_WINDOW_SELECTOR},
  ${FILLS_WINDOW_SELECTOR} body {
    overflow: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} body {
    visibility: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} iframe[data-testid="video-player"] {
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

export const pbsSite: StreamingSite = {
  pluginKey: "PBS",
  domains: ["pbs.org"],
  faviconUrl: "https://www.pbs.org/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  fillWindowStyle: { pageStyle: PBS_FILL_WINDOW_STYLE },
  findPlayButton: () => findFirstVisibleElement(document, ".video-js:not(.vjs-has-started) button.vjs-big-play-button"),
};

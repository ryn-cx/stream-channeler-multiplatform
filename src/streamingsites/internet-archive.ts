import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import { FILLS_WINDOW_SELECTOR } from "../screenautomation/window-filler";
import type { StreamingSite } from "./streaming-site";

// This string was entirely AI generated.
const INTERNET_ARCHIVE_FILL_WINDOW_STYLE = `
  /*
   * A transform, filter or contain on any of the player's ancestors pins the player to that ancestor instead of the
   * window, and a low z-index on an ancestor layers the player below the rest of the page. Both are undone on every
   * ancestor of the player. The rest of the page is not hidden, so the player is pinned on top of it.
   */
  ${FILLS_WINDOW_SELECTOR},
  ${FILLS_WINDOW_SELECTOR} body {
    overflow: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} :has(play-av) {
    transform: none !important;
    filter: none !important;
    backdrop-filter: none !important;
    perspective: none !important;
    contain: none !important;
    will-change: auto !important;
    isolation: auto !important;
    z-index: 2147483000 !important;
  }
  ${FILLS_WINDOW_SELECTOR} play-av {
    display: block !important;
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
`;

const INTERNET_ARCHIVE_SHADOW_ROOT_FILL_STYLE = `
  .av-pill,
  .jwplayer {
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
  }
  .jwplayer video.jw-video {
    object-fit: contain !important;
  }
`;

export const archiveOrgSite: StreamingSite = {
  pluginKey: "Internet Archive",
  domains: ["archive.org"],
  faviconUrl: "https://archive.org/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  findPlayButton: () => findFirstVisibleElement(document, ".jwplayer.jw-state-idle .jw-display-icon-display .jw-icon"),
  fillWindowStyle: {
    pageStyle: INTERNET_ARCHIVE_FILL_WINDOW_STYLE,
    shadowRootStyle: { shadowHostSelector: "play-av", style: INTERNET_ARCHIVE_SHADOW_ROOT_FILL_STYLE },
  },
};

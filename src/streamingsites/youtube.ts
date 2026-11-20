import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { FILLS_WINDOW_SELECTOR } from "../screenautomation/window-filler";
import type { StreamingSite } from "./streaming-site";

// This string was entirely AI generated.
const YOUTUBE_FILL_WINDOW_STYLE = `
  /*
   * #movie_player is the watch page's player, and it is pinned over the whole window. Its ancestors form their own
   * stacking layer, so the related videos column would still draw over a pinned player. Hiding the rest of the app with
   * visibility keeps it out of the way, and the player opts back in. YouTube's popups stay visible, so that prompts
   * such as "Video paused. Continue watching?" can still be seen. YouTube sizes the video element with inline styles,
   * so the video's size needs !important.
   */
  ${FILLS_WINDOW_SELECTOR},
  ${FILLS_WINDOW_SELECTOR} body {
    overflow: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} ytd-app {
    visibility: hidden !important;
  }
  ${FILLS_WINDOW_SELECTOR} #movie_player,
  ${FILLS_WINDOW_SELECTOR} ytd-popup-container {
    visibility: visible !important;
  }
  ${FILLS_WINDOW_SELECTOR} #movie_player {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483000 !important;
    background: #000 !important;
  }
  ${FILLS_WINDOW_SELECTOR} #movie_player .html5-video-container,
  ${FILLS_WINDOW_SELECTOR} #movie_player video.html5-main-video {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
  }
  ${FILLS_WINDOW_SELECTOR} #movie_player video.html5-main-video {
    object-fit: contain !important;
  }
`;

export const youTubeSite: StreamingSite = {
  pluginKey: "YouTube",
  domains: ["youtube.com", "youtu.be"],
  faviconUrl: "https://www.youtube.com/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  fillWindowStyle: { pageStyle: YOUTUBE_FILL_WINDOW_STYLE },
};

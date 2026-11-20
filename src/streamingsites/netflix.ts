import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { findPinInput, findProfileButtonsInside } from "../profiles/streaming-profile-screen";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

export const netflixSite: StreamingSite = {
  pluginKey: "Netflix",
  domains: ["netflix.com"],
  faviconUrl: "https://www.netflix.com/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  skipIntroButton: { find: () => findFirstVisibleElement(document, 'button[data-uia="player-skip-intro"]') },
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, 'button[data-uia="next-episode-seamless-button"]'),
    findDismissButton: () => findFirstVisibleElement(document, 'button[data-uia="watch-credits-seamless-button"]'),
  },
  profileButtons: () =>
    findProfileButtonsInside(
      '[data-uia="profile-selector"] > button[data-uia^="profile-selector+tile-"]',
      ":scope > span",
    ),
  pinEntry: () => findPinInput('input[data-uia="profile-gate-pin+input"]'),
  pathAfterProfileScreen: "/browse",
};

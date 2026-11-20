import { OnScreenElementEndsVideo } from "../playback/endrules/on-screen-element-ends-video";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

export const plutoTvSite: StreamingSite = {
  pluginKey: "Pluto TV",
  domains: ["pluto.tv"],
  faviconUrl: "https://pluto.tv/favicon.ico",
  // BrowserMediaEndedEndsVideo does not work.
  playbackEndDetection: () =>
    new OnScreenElementEndsVideo(() => findFirstVisibleElement(document, '.endcard[data-theme="pluto"] .watch-button')),
  skipRecapButton: { find: () => findFirstVisibleElement(document, 'button[data-skip="skip"][aria-hidden="false"]') },
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, '.endcard[data-theme="pluto-continuous-play"] .watch-button'),
    findDismissButton: () =>
      findFirstVisibleElement(document, '.endcard[data-theme="pluto-continuous-play"] .endcard-close-button'),
  },
};

import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { HiddenPlayerControlsWaker } from "../screenautomation/hidden-player-controls-waker";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

const forcePeacockToShowSkipButtons = new HiddenPlayerControlsWaker(
  '[data-testid="overlay"]',
  (controlsOverlay) => controlsOverlay.dataset.visible === "true",
);

// TODO: Validate
export const peacockSite: StreamingSite = {
  pluginKey: "Peacock",
  domains: ["peacocktv.com"],
  faviconUrl: "https://www.peacocktv.com/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  skipIntroButton: {
    find: () =>
      forcePeacockToShowSkipButtons.findWhileAwake('button[data-testid="skip-button"][aria-label="Skip Intro"]'),
  },
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, 'button[data-testid="binge-card"]'),
    findDismissButton: () => findFirstVisibleElement(document, 'button[data-testid="binge-dismiss-button"]'),
  },
};

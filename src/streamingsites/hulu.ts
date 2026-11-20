import { EpisodeAddressChangeEndsVideo } from "../playback/endrules/episode-address-change-ends-video";
import { findProfileButtonsInside } from "../profiles/streaming-profile-screen";
import {
  findElementWithText,
  findFirstVisibleElement,
  findVisibleElements,
} from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

export const huluSite: StreamingSite = {
  pluginKey: "Hulu",
  domains: ["hulu.com"],
  faviconUrl: "https://www.hulu.com/favicon.ico",
  // BrowserMediaEndedEndsVideo does not work.
  playbackEndDetection: () => new EpisodeAddressChangeEndsVideo(/^\/watch\/([0-9a-f-]+)/),
  skipIntroButton: { find: () => findSkipButton("skip intro") },
  skipRecapButton: { find: () => findSkipButton("skip recap") },
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, '[role="button"][aria-label^="NEXT EPISODE"]'),
    findDismissButton: () => findFirstVisibleElement(document, '[role="button"][aria-label="WATCH CREDITS"]'),
  },
  profileButtons: () =>
    findProfileButtonsInside(
      '[data-testid="ProfileSelectorModal"] a[aria-label^="Switch profile to "]',
      '[data-testid="profile-list-item-name"] > .ProfileList__profile-item--name-displayed',
    ),
};

function findSkipButton(skipButtonText: string): HTMLElement | null {
  return findElementWithText(findVisibleElements(document, 'button[data-testid="player-skip-button"]'), skipButtonText);
}

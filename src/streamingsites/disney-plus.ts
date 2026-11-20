import { OnScreenElementEndsVideo } from "../playback/endrules/on-screen-element-ends-video";
import { findPinDigitInputs, findProfileButtonsNextTo } from "../profiles/streaming-profile-screen";
import {
  findElementWithText,
  findFirstVisibleElement,
  findVisibleElementsInsideHosts,
} from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

// TODO: Validate
export const disneyPlusSite: StreamingSite = {
  pluginKey: "Disney+",
  domains: ["disneyplus.com"],
  faviconUrl: "https://www.disneyplus.com/favicon.ico",
  // BrowserMediaEndedEndsVideo and MediaIdChangeEndsVideo (PROBABLY?) do not work. This implementation detects the
  // end screen that is shown when a video is functionally complete but the silent part of credits will often get cut
  // off.
  playbackEndDetection: () =>
    new OnScreenElementEndsVideo(() =>
      findFirstVisibleElement(document, '[data-testid="explore-post-play-view"] button'),
    ),
  skipIntroButton: { find: () => findSkipButton(document, "skip intro") },
  skipRecapButton: { find: () => findSkipButton(document, "skip recap") },
  skipCreditsButton: { find: () => findSkipButton(document, "skip credits") },
  // Used for episodes in the middle of the series only.
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, '[data-qa="end-card-overlay.contentTile"]'),
    findDismissButton: () => findFirstVisibleElement(document, '[data-qa="end-card-overlay.closeButton"]'),
  },
  profileButtons: () =>
    findProfileButtonsNextTo('[data-testid="select-profile"] [role="listitem"] > button[aria-label^="Access "]', "h4"),
  pinEntry: () => findPinDigitInputs('[data-testid="pin-entry"] input'),
};

export function findSkipButton(pageDocument: Document, skipButtonText: string): HTMLElement | null {
  return findElementWithText(findVisibleElementsInsideHosts(pageDocument, "skip-overlay", "button"), skipButtonText);
}

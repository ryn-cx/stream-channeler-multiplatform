import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { findPinDigitInputs, findProfileButtonsInside } from "../profiles/streaming-profile-screen";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

export const hboMaxSite: StreamingSite = {
  pluginKey: "HBO Max",
  domains: ["hbomax.com", "max.com"],
  faviconUrl: "https://play.hbomax.com/favicon.ico",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  skipIntroButton: { find: () => findSkipButton("Skip Intro") },
  skipRecapButton: { find: () => findSkipButton("Skip Recap") },
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, 'button[data-testid="player-ux-up-next-button"]'),
  },
  profileButtons: () =>
    findProfileButtonsInside('[data-test-profile-id] > button[data-testid="edit_avatar_selection_button"]', "p"),
  pinEntry: () => findPinDigitInputs('[data-testid="pin_field"] input[aria-label^="PIN digit "]'),
};

function findSkipButton(skipButtonAriaLabel: string): HTMLElement | null {
  return findFirstVisibleElement(
    document,
    `button[data-testid="player-ux-skip-button"][aria-label="${skipButtonAriaLabel}"]`,
  );
}

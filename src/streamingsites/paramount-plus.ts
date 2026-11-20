import { MediaIdChangeEndsVideo } from "../playback/endrules/media-id-change-ends-video";
import { findProfileButtonsInside } from "../profiles/streaming-profile-screen";
import { findFirstVisibleElement } from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

// TODO: Validate
export const paramountPlusSite: StreamingSite = {
  pluginKey: "Paramount+",
  domains: ["paramountplus.com"],
  faviconUrl: "https://www.paramountplus.com/favicon.ico",
  // BrowserMediaEndedEndsVideo does not work.
  playbackEndDetection: () => new MediaIdChangeEndsVideo(),
  // Only required for movies.
  // Paramount+ ignores a click on the Play button itself. It listens on the empty overlay laid over the start panel.
  findPlayButton: () => findFirstVisibleElement(document, ".start-panel.show .start-panel-click-overlay"),
  skipIntroButton: { find: () => findFirstVisibleElement(document, 'button[data-skip="skip"][aria-hidden="false"]') },
  nextEpisodeButton: {
    find: () => findFirstVisibleElement(document, ".endcard .watch-button"),
    // The episode end card has a close button. The movie end card has none. It shrinks the playing video into a corner
    // instead, and clicking the shrunken video's thumbnail brings the video back to full size.
    findDismissButton: () =>
      findFirstVisibleElement(document, ".endcard .endcard-close-button") ??
      findFirstVisibleElement(document, ".uec-credits-box .tween-down-thumbnail.show"),
  },
  profileButtons: () =>
    findProfileButtonsInside(
      '[role="button"][data-ci="avatar"][data-cta-text="select_profile"]',
      ".vds-interactive-avatar__label",
    ),
};

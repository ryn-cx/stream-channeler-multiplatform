import { MediaIdChangeEndsVideo } from "../playback/endrules/media-id-change-ends-video";
import { findProfileButtonsInside } from "../profiles/streaming-profile-screen";
import { findFirstVisibleElement, findVisibleElements } from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

export const primeVideoSite: StreamingSite = {
  pluginKey: "Amazon",
  domains: ["primevideo.com", "amazon.com"],
  faviconUrl: "https://www.primevideo.com/favicon.ico",
  // BrowserMediaEndedEndsVideo does not work.
  playbackEndDetection: () => new MediaIdChangeEndsVideo(),
  skipIntroButton: { find: () => findFirstVisibleElement(document, 'button[aria-label="Skip Intro"]') },
  skipRecapButton: { find: () => findFirstVisibleElement(document, 'button[aria-label="Skip Recap"]') },
  nextEpisodeButton: { find: findNextEpisodeButton, findDismissButton: findNextEpisodeDismissButton },
  // This screen never actually shows up when opening a link and the last used profile will be used instead.
  // TODO: Consider implementing a feature where the profile is always manually picked before playing the video.
  profileButtons: () =>
    findProfileButtonsInside(
      '[data-testid="profile-identity-form"] button[aria-label^="Switch to "]',
      '[data-automation-id="profile-item-name"]',
    ),
};

function findNextEpisodeButton(): HTMLElement | null {
  // Used for episodes in the middle of the series.
  const nextEpisodeCard = findFirstVisibleElement(
    document,
    ".atvwebplayersdk-nextupcard-show .atvwebplayersdk-nextupcard-button",
  );
  if (nextEpisodeCard) return nextEpisodeCard;

  // Used for movies (and probably the last episode of a series).
  const nextEpisodeCarousel = findVisibleElements(
    document,
    ".atvwebplayersdk-carousel .atvweb-inplayback-carousel-card-status",
  ).find((carouselCardStatus) => (carouselCardStatus.textContent ?? "").trim().startsWith("Starts in"));
  if (nextEpisodeCarousel) return nextEpisodeCarousel.closest("button");

  return null;
}

function findNextEpisodeDismissButton(): HTMLElement | null {
  // Episode in the middle of the series show an upcoming episode card.
  const nextEpisodeCardButton = findFirstVisibleElement(
    document,
    ".atvwebplayersdk-nextupcard-show .atvwebplayersdk-nextupcardhide-button",
  );
  if (nextEpisodeCardButton) return nextEpisodeCardButton;

  // This version of the next episode button is used for movies.
  const nextEpisodeCarouselButton = findFirstVisibleElement(document, 'button[aria-label="Stop autoplay"]');
  if (nextEpisodeCarouselButton) return nextEpisodeCarouselButton;

  return null;
}

// TODO: Validate
import type { GuideVideo } from "../data/models";
import type { AdMarker } from "../playback/ads/ad-marker";
import type { PlaybackEndRule } from "../playback/endrules/playback-end-rule";
import type { PinEntry, ProfileButton } from "../profiles/streaming-profile-screen";
import type { FillWindowStyle } from "../screenautomation/window-filler";
import { primeVideoSite } from "./amazon-prime-video";
import { crunchyrollSite } from "./crunchyroll";
import { disneyPlusSite } from "./disney-plus";
import { hboMaxSite } from "./hbo-max";
import { hidiveSite } from "./hidive";
import { huluSite } from "./hulu";
import { archiveOrgSite } from "./internet-archive";
import { netflixSite } from "./netflix";
import { nhkWorldSite } from "./nhk-world";
import { paramountPlusSite } from "./paramount-plus";
import { pbsSite } from "./pbs";
import { peacockSite } from "./peacock";
import { plutoTvSite } from "./pluto-tv";
import { rokuChannelSite } from "./roku-channel";
import { tubiSite } from "./tubi";
import { youTubeSite } from "./youtube";

export type PlayerButtonField =
  | "skipIntroButton"
  | "skipRecapButton"
  | "skipCreditsButton"
  | "skipPreviewButton"
  | "nextEpisodeButton";

/** A button that a site shows over its video, such as Skip Intro or the next episode card. */
export interface PlayerButton {
  /** Returns the button while it is showing, or null otherwise. */
  find: () => HTMLElement | null;
  /**
   * Returns the button that cancels the site's own countdown on this button while it is showing, or null otherwise. The
   * player page clicks it unless this button appearing is one of the moments that play the next episode, so the rest
   * of the video plays out instead of the site moving on early.
   */
  findDismissButton?: () => HTMLElement | null;
}

export interface StreamingSite {
  pluginKey: string;
  domains: string[];
  /** The address of the website's own icon. The settings show it on the website's tab. */
  faviconUrl: string;
  /** Builds the rule that finishes the video when the episode ends. */
  playbackEndDetection: () => PlaybackEndRule;
  // The buttons the site shows over its video. PLAYER_BUTTON_KINDS says what each kind of button is used for.
  skipIntroButton?: PlayerButton;
  skipRecapButton?: PlayerButton;
  skipCreditsButton?: PlayerButton;
  skipPreviewButton?: PlayerButton;
  nextEpisodeButton?: PlayerButton;
  /**
   * Returns the button that starts the video on a site that waits for a click to play, or null when it is not showing.
   * The player page clicks it until playback starts.
   */
  findPlayButton?: () => HTMLElement | null;
  fillWindowStyle?: FillWindowStyle;
  /** Returns the profiles shown on the site's profile screen, or an empty list when the screen is not showing. */
  profileButtons?: () => ProfileButton[];
  /** Returns the site's PIN fields while its PIN screen is showing, or null otherwise. */
  pinEntry?: () => PinEntry | null;
  /**
   * The path the site sends the viewer to after a profile is picked or its PIN is entered, instead of the video. The
   * profile picker opens the video's address again when the page lands on this path.
   */
  pathAfterProfileScreen?: string;
  createAdMarker?: () => AdMarker;
}

export const ALL_STREAMING_SITES: StreamingSite[] = [
  netflixSite,
  youTubeSite,
  primeVideoSite,
  huluSite,
  disneyPlusSite,
  hboMaxSite,
  tubiSite,
  plutoTvSite,
  peacockSite,
  paramountPlusSite,
  crunchyrollSite,
  hidiveSite,
  rokuChannelSite,
  pbsSite,
  nhkWorldSite,
  archiveOrgSite,
];

// TODO: Validate
/** Returns whether the profile picker can pick a profile or enter a PIN on streamingSite. */
export function hasProfileScreen(streamingSite: StreamingSite): boolean {
  return streamingSite.profileButtons !== undefined || streamingSite.pinEntry !== undefined;
}

// TODO: Validate
export function streamingSiteForHost(host: string): StreamingSite | null {
  const lowercaseHost = host.toLowerCase();
  return (
    ALL_STREAMING_SITES.find((streamingSite) =>
      streamingSite.domains.some((domain) => lowercaseHost === domain || lowercaseHost.endsWith(`.${domain}`)),
    ) ?? null
  );
}

// TODO: Validate
export function findStreamingSite(video: GuideVideo): StreamingSite | null {
  const pluginKeySite = ALL_STREAMING_SITES.find((streamingSite) => streamingSite.pluginKey === video.pluginKey);
  if (pluginKeySite !== undefined) return pluginKeySite;
  const videoHost = videoUrlHost(video);
  return videoHost === null ? null : streamingSiteForHost(videoHost);
}

// TODO: Validate
export function streamingSiteName(video: GuideVideo): string {
  return findStreamingSite(video)?.pluginKey ?? video.pluginKey ?? video.sourceKey;
}

// TODO: Validate
export function videoUrlHost(video: GuideVideo): string | null {
  if (video.url === null) return null;
  try {
    return new URL(video.url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

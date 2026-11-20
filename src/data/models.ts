// TODO: Validate
import { type JsonObject, optionalBoolean, optionalObject } from "./json-fields";

export interface GuideVideo {
  episodeId: string;
  title: string | null;
  subtitle: string;
  url: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  faviconUrl: string | null;
  sourceKey: string;
  pluginKey: string | null;
  watched: boolean;
  watchCompleted: boolean;
  watchId: string | null;
  titleId: string | null;
  description: string | null;
}

export interface GuideChannel {
  id: string;
  name: string | null;
  number: number | null;
  defaultOrder: string | null;
  videos: GuideVideo[];
  imageUrl: string | null;
  hasMoreVideos: boolean;
  authorUsername: string | null;
}

export interface GuideVideosPage {
  videos: GuideVideo[];
  hasMoreVideos: boolean;
}

export interface ChannelListItem {
  id: string;
  name: string | null;
  channelNumber: number | null;
  defaultOrder: string | null;
  customName: string | null;
  customChannelNumber: number | null;
  imageId: string | null;
  authorUsername: string | null;
  bundledVideosPage: GuideVideosPage | null;
}

export interface OrderSeeds {
  minimumEpisodeOrderSeed: number;
  channelOrderSeed: number;
  channelIdToEpisodeOrderSeed: Record<string, number>;
}

// TODO: Validate
export function episodeSeedForChannel(orderSeeds: OrderSeeds, channelId: string): number {
  return Math.max(orderSeeds.channelIdToEpisodeOrderSeed[channelId] ?? 0, orderSeeds.minimumEpisodeOrderSeed);
}

export interface SignedInUser {
  username: string;
  userJson: JsonObject;
}

export interface DeviceSignInCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
  pollIntervalSeconds: number;
}

export interface ChannelRefreshSettings {
  refreshesEpisodesAutomatically: boolean | null;
  shufflesEpisodesAutomatically: boolean | null;
}

// TODO: Validate
export function followsAccountDefaults(channelRefreshSettings: ChannelRefreshSettings): boolean {
  return (
    channelRefreshSettings.refreshesEpisodesAutomatically === null &&
    channelRefreshSettings.shufflesEpisodesAutomatically === null
  );
}

// TODO: Validate
export function channelRefreshSettingsJson(channelRefreshSettings: ChannelRefreshSettings): JsonObject {
  return {
    refreshes_episodes_automatically: channelRefreshSettings.refreshesEpisodesAutomatically,
    shuffles_episodes_automatically: channelRefreshSettings.shufflesEpisodesAutomatically,
  };
}

export interface AccountRefreshSettings {
  refreshesChannelsAutomatically: boolean;
  refreshesEpisodesAutomatically: boolean;
  shufflesEpisodesAutomatically: boolean;
  channelIdToRefreshSettings: Record<string, ChannelRefreshSettings>;
}

// TODO: Validate
export function hasAutomaticSettings(accountRefreshSettings: AccountRefreshSettings): boolean {
  return (
    accountRefreshSettings.refreshesChannelsAutomatically ||
    accountRefreshSettings.refreshesEpisodesAutomatically ||
    accountRefreshSettings.shufflesEpisodesAutomatically ||
    Object.values(accountRefreshSettings.channelIdToRefreshSettings).some(
      (channelRefreshSettings) =>
        channelRefreshSettings.refreshesEpisodesAutomatically === true ||
        channelRefreshSettings.shufflesEpisodesAutomatically === true,
    )
  );
}

export interface AutomaticRefreshResult {
  refreshedChannels: boolean;
  changedEveryChannelsEpisodes: boolean;
  changedEpisodesChannelIds: string[];
}

export type ChannelEpisodesAction = "RESORT" | "CHECK_FOR_NEW_EPISODES" | "LOAD_MORE_EPISODES";

export type AfterVideoEnds = "PLAY_NEXT_VIDEO" | "RETURN_TO_GUIDE";

export type GuideScope = "PUBLIC" | "FAVORITES" | "OWNED";

export const ALL_GUIDE_SCOPES: GuideScope[] = ["PUBLIC", "FAVORITES", "OWNED"];

export const GUIDE_SCOPE_QUERY_VALUES: Record<GuideScope, string> = {
  PUBLIC: "public",
  FAVORITES: "favorites",
  OWNED: "owned",
};

// TODO: Validate
export function formatChannelNumber(channelNumber: number | null): string | null {
  return channelNumber === null ? null : String(channelNumber);
}

// TODO: Validate
export function nextPlayableVideo(channel: GuideChannel, afterEpisodeId: string | null): GuideVideo | null {
  const playingVideoIndex = channel.videos.findIndex((video) => video.episodeId === afterEpisodeId);
  return (
    channel.videos
      .slice(playingVideoIndex + 1)
      .find((video) => video.episodeId !== afterEpisodeId && video.url !== null) ?? null
  );
}

// TODO: Validate
/**
 * Returns the last video with a link that comes before beforeEpisodeId in the channel, or null when there is none or
 * the channel does not have beforeEpisodeId.
 */
export function previousPlayableVideo(channel: GuideChannel, beforeEpisodeId: string): GuideVideo | null {
  const playingVideoIndex = channel.videos.findIndex((video) => video.episodeId === beforeEpisodeId);
  if (playingVideoIndex === -1) return null;
  return (
    channel.videos
      .slice(0, playingVideoIndex)
      .findLast((video) => video.episodeId !== beforeEpisodeId && video.url !== null) ?? null
  );
}

// TODO: Validate
export function accountRefreshSettingsFromJson(userJson: JsonObject): AccountRefreshSettings {
  const channelIdToRefreshSettingsJson = optionalObject(userJson, "channel_id_to_refresh_settings") ?? {};
  const channelIdToRefreshSettings: Record<string, ChannelRefreshSettings> = {};
  for (const [channelId, channelRefreshSettingsJson] of Object.entries(channelIdToRefreshSettingsJson)) {
    const channelRefreshSettingsObject = (channelRefreshSettingsJson ?? {}) as JsonObject;
    channelIdToRefreshSettings[channelId] = {
      refreshesEpisodesAutomatically: optionalBoolean(channelRefreshSettingsObject, "refreshes_episodes_automatically"),
      shufflesEpisodesAutomatically: optionalBoolean(channelRefreshSettingsObject, "shuffles_episodes_automatically"),
    };
  }
  return {
    refreshesChannelsAutomatically: optionalBoolean(userJson, "refreshes_channels_automatically") ?? false,
    refreshesEpisodesAutomatically: optionalBoolean(userJson, "refreshes_episodes_automatically") ?? false,
    shufflesEpisodesAutomatically: optionalBoolean(userJson, "shuffles_episodes_automatically") ?? false,
    channelIdToRefreshSettings,
  };
}

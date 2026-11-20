// TODO: Validate
import {
  arrayOfObjects,
  arrayOfStrings,
  isJsonObject,
  type JsonObject,
  optionalNumber,
  optionalObject,
  optionalString,
  requiredArray,
  requiredBoolean,
  requiredNumber,
  requiredObject,
  requiredString,
} from "./json-fields";
import {
  type AutomaticRefreshResult,
  type ChannelListItem,
  type ChannelRefreshSettings,
  channelRefreshSettingsJson,
  type DeviceSignInCode,
  formatChannelNumber,
  GUIDE_SCOPE_QUERY_VALUES,
  type GuideScope,
  type GuideVideo,
  type GuideVideosPage,
  type SignedInUser,
} from "./models";

export const API_ORIGIN = "https://api.streamchanneler.com";
const REQUEST_TIMEOUT = 30_000;

// TODO: Validate
export class ApiException extends Error {
  readonly statusCode: number;
  readonly isSignInRejected: boolean;

  // TODO: Validate
  constructor(statusCode: number, message: string, isSignInRejected = false) {
    super(message);
    this.name = "ApiException";
    this.statusCode = statusCode;
    this.isSignInRejected = isSignInRejected;
  }
}

type AuthorizationMode = "NONE" | "OPTIONAL" | "REQUIRED";

// TODO: Validate
export class StreamChannelerApi {
  private readonly readAccessToken: () => string | null;

  // TODO: Validate
  constructor(readAccessToken: () => string | null) {
    this.readAccessToken = readAccessToken;
  }

  // TODO: Validate
  async logIn(usernameOrEmail: string, password: string): Promise<string> {
    const loginFormBody = new URLSearchParams({
      grant_type: "password",
      username: usernameOrEmail,
      password,
    }).toString();
    const loginResponseJson = await this.requestJson("POST", apiUrl("/login/access-token"), "NONE", {
      body: loginFormBody,
      contentType: "application/x-www-form-urlencoded",
    });
    return requiredString(loginResponseJson, "access_token");
  }

  // TODO: Validate
  async requestDeviceSignInCode(): Promise<DeviceSignInCode> {
    const deviceCodeJson = await this.requestJson("POST", apiUrl("/login/device-code"), "NONE");
    return {
      deviceCode: requiredString(deviceCodeJson, "device_code"),
      userCode: requiredString(deviceCodeJson, "user_code"),
      verificationUri: requiredString(deviceCodeJson, "verification_uri"),
      expiresInSeconds: requiredNumber(deviceCodeJson, "expires_in"),
      pollIntervalSeconds: requiredNumber(deviceCodeJson, "interval"),
    };
  }

  // TODO: Validate
  async exchangeDeviceSignInCode(deviceCode: string): Promise<string | null> {
    const deviceTokenJson = await this.requestJson("POST", apiUrl("/login/device-token"), "NONE", {
      body: JSON.stringify({ device_code: deviceCode }),
    });
    return optionalString(deviceTokenJson, "access_token");
  }

  // TODO: Validate
  async signOutDevice(signedOutAccessToken: string): Promise<void> {
    await sendRequest("DELETE", apiUrl("/users/me/devices/current"), signedOutAccessToken, null, "application/json");
  }

  // TODO: Validate
  async fetchSignedInUser(): Promise<SignedInUser> {
    const userJson = await this.requestJson("GET", apiUrl("/users/me"), "REQUIRED");
    return { username: requiredString(userJson, "username"), userJson };
  }

  // TODO: Validate
  async updateChannelRefreshSettings(channelId: string, channelRefreshSettings: ChannelRefreshSettings): Promise<void> {
    await this.request(
      "PUT",
      apiUrl(`/users/me/channel-refresh-settings/${encodeURIComponent(channelId)}`),
      "REQUIRED",
      {
        body: JSON.stringify(channelRefreshSettingsJson(channelRefreshSettings)),
      },
    );
  }

  // TODO: Validate
  async updatePluginProfile(
    pluginKey: string,
    profileName: string | null,
    profilePin: string | null,
  ): Promise<JsonObject> {
    const updatedPreferencesJson = await this.requestJson("PUT", apiUrl("/users/me/preferences"), "REQUIRED", {
      body: JSON.stringify({
        plugin_key_to_profile: {
          // The profile number is left out, so the server keeps the number the Android app picks profiles by.
          [pluginKey]: { profile_name: profileName, pin: profilePin },
        },
      }),
    });
    return optionalObject(requiredObject(updatedPreferencesJson, "user"), "plugin_key_to_profile") ?? {};
  }

  // TODO: Validate
  async runAutomaticRefresh(): Promise<AutomaticRefreshResult> {
    const automaticRefreshJson = await this.requestJson(
      "POST",
      apiUrl("/users/me/automatic-refresh", [["opens_channel_list", "true"]]),
      "REQUIRED",
    );
    return {
      refreshedChannels: requiredBoolean(automaticRefreshJson, "refreshed_channels"),
      changedEveryChannelsEpisodes: requiredBoolean(automaticRefreshJson, "changed_every_channels_episodes"),
      changedEpisodesChannelIds: arrayOfStrings(requiredArray(automaticRefreshJson, "changed_episodes_channel_ids")),
    };
  }

  // TODO: Validate
  async refreshAndShuffleAll(): Promise<void> {
    await this.request("POST", apiUrl("/users/me/refresh-and-shuffle-all"), "REQUIRED");
  }

  // TODO: Validate
  async fetchChannelList(
    guideScope: GuideScope,
    offset: number,
    limit: number,
    channelOrderSeed: number | null,
    filterOptions: JsonObject[] = [],
    titleId: string | null = null,
    runsAutomaticRefresh = false,
  ): Promise<ChannelListItem[]> {
    const minimumCount = guideScope === "PUBLIC" ? "1" : "0";
    const channelListQuery: [string, string][] = [
      ["scope", GUIDE_SCOPE_QUERY_VALUES[guideScope]],
      ["offset", String(offset)],
      ["limit", String(limit)],
      ["min_title_count", minimumCount],
      ["min_episode_count", minimumCount],
    ];
    if (channelOrderSeed !== null) channelListQuery.push(["random_seed", String(channelOrderSeed)]);
    channelListQuery.push(["sort_options", "[]"], ["filter_options", JSON.stringify(filterOptions)]);
    if (titleId !== null) channelListQuery.push(["title_id", titleId]);
    if (runsAutomaticRefresh) {
      channelListQuery.push(["runs_automatic_refresh", "true"], ["automatic_refresh_opens_channel_list", "true"]);
    }
    const authorizationMode: AuthorizationMode = guideScope === "PUBLIC" ? "OPTIONAL" : "REQUIRED";
    const channelListJson = await this.requestJson(
      "GET",
      apiUrl("/channels/with-episodes", channelListQuery),
      authorizationMode,
    );
    const channelsJson = arrayOfObjects(requiredArray(channelListJson, "data"));
    const channelIdToEpisodesJson = requiredObject(channelListJson, "episodes");
    return channelsJson.map((channelJson) => {
      const channelId = requiredString(channelJson, "id");
      const bundledEpisodesJson = optionalObject(channelIdToEpisodesJson, channelId);
      return {
        id: channelId,
        name: optionalString(channelJson, "name"),
        channelNumber: optionalNumber(channelJson, "channel_number"),
        defaultOrder: optionalString(channelJson, "default_order"),
        customName: optionalString(channelJson, "custom_name"),
        customChannelNumber: optionalNumber(channelJson, "custom_channel_number"),
        imageId: optionalString(channelJson, "image_id"),
        authorUsername: optionalString(channelJson, "username"),
        bundledVideosPage:
          bundledEpisodesJson === null
            ? null
            : {
                videos: guideVideos(bundledEpisodesJson),
                hasMoreVideos: requiredBoolean(bundledEpisodesJson, "has_more"),
              },
      };
    });
  }

  // TODO: Validate
  async fetchChannelVideos(channelId: string, episodeSeed: number | null, videoOffset = 0): Promise<GuideVideosPage> {
    const channelVideosQuery: [string, string][] = [
      ["limit", String(20)],
      ["offset", String(videoOffset)],
    ];
    if (episodeSeed !== null) channelVideosQuery.push(["randomSeed", String(episodeSeed)]);
    channelVideosQuery.push(["userCurrentTime", localTimeWithOffset(new Date())]);
    const channelEpisodesJson = await this.requestJson(
      "GET",
      apiUrl(`/channels/${encodeURIComponent(channelId)}/default-order-episodes`, channelVideosQuery),
      "OPTIONAL",
    );
    return {
      videos: guideVideos(channelEpisodesJson),
      hasMoreVideos: requiredBoolean(channelEpisodesJson, "has_more"),
    };
  }

  // TODO: Validate
  async advanceChannelEpisodeSeeds(channelIds: string[]): Promise<void> {
    await this.request("POST", apiUrl("/users/me/episode-seeds/channels/advance"), "REQUIRED", {
      body: JSON.stringify({ channel_ids: channelIds }),
    });
  }

  // TODO: Validate
  async advanceEveryChannelEpisodeSeed(): Promise<void> {
    await this.request("POST", apiUrl("/users/me/episode-seeds/advance"), "REQUIRED");
  }

  // TODO: Validate
  async advanceChannelOrderSeed(): Promise<void> {
    await this.request("POST", apiUrl("/users/me/episode-seeds/channel-order/advance"), "REQUIRED");
  }

  // TODO: Validate
  async forgetStoredEpisodeOrders(channelIds: string[] | null): Promise<void> {
    await this.request("POST", apiUrl("/users/me/stored-episode-orders/forget"), "REQUIRED", {
      body: JSON.stringify({ channel_ids: channelIds }),
    });
  }

  // TODO: Validate
  async favoriteChannel(channelId: string): Promise<void> {
    await this.request("POST", apiUrl(`/channels/${encodeURIComponent(channelId)}/favorite`), "REQUIRED");
  }

  // TODO: Validate
  async unfavoriteChannel(channelId: string): Promise<void> {
    await this.request("DELETE", apiUrl(`/channels/${encodeURIComponent(channelId)}/favorite`), "REQUIRED");
  }

  // TODO: Validate
  async markEpisodeWatched(episodeId: string, completed: boolean, channelId: string): Promise<string> {
    const createdWatchJson = await this.requestJson(
      "POST",
      apiUrl(`/episodes/${encodeURIComponent(episodeId)}/watches`),
      "REQUIRED",
      {
        body: JSON.stringify({ watch_date: new Date().toISOString(), completed, channel_id: channelId }),
      },
    );
    return requiredString(createdWatchJson, "id");
  }

  // TODO: Validate
  async fetchIncompleteWatchId(episodeId: string): Promise<string | null> {
    const watchesResponseText = await this.request(
      "GET",
      apiUrl(`/episodes/${encodeURIComponent(episodeId)}/watches`),
      "REQUIRED",
    );
    const watchesJson = parseJsonArray(watchesResponseText);
    const incompleteWatchJson = arrayOfObjects(watchesJson).find((watchJson) => watchJson.completed !== true);
    return incompleteWatchJson === undefined ? null : requiredString(incompleteWatchJson, "id");
  }

  // TODO: Validate
  async completeWatch(watchId: string): Promise<void> {
    await this.request("PATCH", apiUrl(`/watches/${encodeURIComponent(watchId)}`), "REQUIRED", {
      body: JSON.stringify({ completed: true }),
    });
  }

  // TODO: Validate
  async deleteWatch(watchId: string): Promise<void> {
    await this.request("DELETE", apiUrl(`/watches/${encodeURIComponent(watchId)}`), "REQUIRED");
  }

  // TODO: Validate
  channelImageUrl(imageId: string): string {
    return apiUrl(`/channel-images/${encodeURIComponent(imageId)}/w300`);
  }

  // TODO: Validate
  private async requestJson(
    method: string,
    url: string,
    authorizationMode: AuthorizationMode,
    requestBody: { body: string; contentType?: string } | null = null,
  ): Promise<JsonObject> {
    const responseText = await this.request(method, url, authorizationMode, requestBody);
    const responseJson: unknown = JSON.parse(responseText);
    if (!isJsonObject(responseJson)) throw new SyntaxError(`${method} ${url} didn't answer with an object`);
    return responseJson;
  }

  // TODO: Validate
  private async request(
    method: string,
    url: string,
    authorizationMode: AuthorizationMode,
    requestBody: { body: string; contentType?: string } | null = null,
  ): Promise<string> {
    const accessToken = this.readAccessToken();
    if (authorizationMode === "REQUIRED" && !accessToken) throw new ApiException(401, "Not signed in");
    const sentAccessToken = accessToken && authorizationMode !== "NONE" ? accessToken : null;
    const body = requestBody?.body ?? null;
    const contentType = requestBody?.contentType ?? "application/json";
    try {
      return await sendRequest(method, url, sentAccessToken, body, contentType);
    } catch (rejectedSignInError) {
      const isRetriedWithoutSignIn =
        rejectedSignInError instanceof ApiException &&
        rejectedSignInError.isSignInRejected &&
        authorizationMode === "OPTIONAL";
      if (!isRetriedWithoutSignIn) throw rejectedSignInError;
      return sendRequest(method, url, null, body, contentType);
    }
  }
}

// TODO: Validate
async function sendRequest(
  method: string,
  url: string,
  sentAccessToken: string | null,
  body: string | null,
  contentType: string,
): Promise<string> {
  const requestHeaders: Record<string, string> = { Accept: "application/json" };
  if (sentAccessToken !== null) requestHeaders.Authorization = `Bearer ${sentAccessToken}`;
  if (body !== null) requestHeaders["Content-Type"] = contentType;
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  const responseText = await response.text();
  if (!response.ok) {
    const responseErrorDetail = errorDetail(responseText);
    const isSignInRejected =
      sentAccessToken !== null &&
      (response.status === 401 ||
        (response.status === 403 && responseErrorDetail === "Could not validate credentials"));
    throw new ApiException(
      response.status,
      responseErrorDetail ?? `${method} ${url} failed: ${response.status}`,
      isSignInRejected,
    );
  }
  return responseText;
}

// TODO: Validate
function errorDetail(responseText: string): string | null {
  let responseJson: unknown;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    return null;
  }
  if (!isJsonObject(responseJson)) return null;
  const detail = responseJson.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && isJsonObject(detail[0])) return optionalString(detail[0], "msg");
  return null;
}

// TODO: Validate
function parseJsonArray(responseText: string): unknown[] {
  const responseJson: unknown = JSON.parse(responseText);
  if (!Array.isArray(responseJson)) throw new SyntaxError("The server didn't answer with a list");
  return responseJson;
}

// TODO: Validate
function apiUrl(path: string, query: [string, string][] = []): string {
  const queryString = new URLSearchParams(query).toString();
  return `${API_ORIGIN}/api/v1${path}${queryString.length === 0 ? "" : `?${queryString}`}`;
}

// TODO: Validate
function guideVideos(channelEpisodesJson: JsonObject): GuideVideo[] {
  const episodesJson = arrayOfObjects(requiredArray(channelEpisodesJson, "episodes"));
  const seasonIdToSeasonJson = requiredObject(channelEpisodesJson, "seasons");
  const titleIdToTitleJson = requiredObject(channelEpisodesJson, "titles");
  const sourceIdToSourceJson = requiredObject(channelEpisodesJson, "sources");
  const pluginIdToPluginJson = requiredObject(channelEpisodesJson, "plugins");
  return episodesJson.map((episodeJson) =>
    guideVideo(episodeJson, seasonIdToSeasonJson, titleIdToTitleJson, sourceIdToSourceJson, pluginIdToPluginJson),
  );
}

// TODO: Validate
function guideVideo(
  episodeJson: JsonObject,
  seasonIdToSeasonJson: JsonObject,
  titleIdToTitleJson: JsonObject,
  sourceIdToSourceJson: JsonObject,
  pluginIdToPluginJson: JsonObject,
): GuideVideo {
  const seasonJson = requiredObject(seasonIdToSeasonJson, requiredString(episodeJson, "season_id"));
  const titleJson = requiredObject(titleIdToTitleJson, requiredString(seasonJson, "title_id"));
  const sourceJson = requiredObject(sourceIdToSourceJson, requiredString(titleJson, "source_id"));
  const sourcePluginId = optionalString(sourceJson, "plugin_id");
  const pluginJson = sourcePluginId === null ? null : optionalObject(pluginIdToPluginJson, sourcePluginId);
  return {
    episodeId: requiredString(episodeJson, "id"),
    title: optionalString(titleJson, "name"),
    subtitle: videoSubtitle(episodeJson, seasonJson, titleJson),
    url: optionalString(episodeJson, "url"),
    durationSeconds: optionalNumber(episodeJson, "duration"),
    thumbnailUrl: resolveAssetUrl(videoThumbnailUrl(episodeJson)),
    faviconUrl: resolveAssetUrl(optionalString(sourceJson, "favicon_url")),
    sourceKey: optionalString(sourceJson, "key") ?? "",
    pluginKey: pluginJson === null ? null : optionalString(pluginJson, "key"),
    watched: episodeJson.watch_date !== undefined && episodeJson.watch_date !== null,
    watchCompleted: episodeJson.completed === true,
    watchId: optionalString(episodeJson, "episode_watch_id"),
    titleId: requiredString(seasonJson, "title_id"),
    description: optionalString(episodeJson, "description"),
  };
}

// TODO: Validate
function videoSubtitle(episodeJson: JsonObject, seasonJson: JsonObject, titleJson: JsonObject): string {
  if (optionalString(titleJson, "media_type") === "Movie") return "Movie";
  const tmdbEpisodeId = optionalString(episodeJson, "tmdb_episode_id");
  const isLinkedToTmdbEpisode = tmdbEpisodeId !== null && tmdbEpisodeId !== requiredString(episodeJson, "id");
  const seasonNumber = isLinkedToTmdbEpisode
    ? optionalNumber(episodeJson, "tmdb_season_number")
    : optionalNumber(seasonJson, "season_number");
  const episodeNumber = isLinkedToTmdbEpisode
    ? optionalNumber(episodeJson, "tmdb_episode_number")
    : optionalNumber(episodeJson, "episode_number");
  let episodeNumbering: string | null = null;
  if (seasonNumber !== null && episodeNumber !== null) {
    episodeNumbering = `S${formatChannelNumber(seasonNumber)} Ep${formatChannelNumber(episodeNumber)}`;
  } else if (episodeNumber !== null) {
    episodeNumbering = `Ep${formatChannelNumber(episodeNumber)}`;
  }
  return [episodeNumbering, optionalString(episodeJson, "name")]
    .filter((subtitlePart) => subtitlePart !== null)
    .join(" · ");
}

// TODO: Validate
function videoThumbnailUrl(episodeJson: JsonObject): string | null {
  const imagesJson = episodeJson.images;
  if (!Array.isArray(imagesJson)) return null;
  const imageObjects = imagesJson.filter(isJsonObject);
  for (const imageKind of ["still", "backdrop", "poster"]) {
    const imageJson = imageObjects.find((imageObject) => optionalString(imageObject, "kind") === imageKind);
    if (imageJson === undefined) continue;
    const imageUrlsJson = optionalObject(imageJson, "urls");
    if (imageUrlsJson === null) continue;
    for (const imageSize of ["w300", "w780", "original"]) {
      const sizedImageUrl = optionalString(imageUrlsJson, imageSize);
      if (sizedImageUrl !== null) return sizedImageUrl;
    }
    return null;
  }
  return null;
}

// TODO: Validate
function resolveAssetUrl(assetUrl: string | null): string | null {
  if (assetUrl === null) return null;
  try {
    return new URL(assetUrl, `${API_ORIGIN}/`).toString();
  } catch {
    return assetUrl;
  }
}

// TODO: Validate
function twoDigits(timePart: number): string {
  return String(timePart).padStart(2, "0");
}

// TODO: Validate
export function localTimeWithOffset(localTime: Date): string {
  const offsetMinutesEastOfUtc = -localTime.getTimezoneOffset();
  const localDateAndTime =
    `${localTime.getFullYear()}-${twoDigits(localTime.getMonth() + 1)}-${twoDigits(localTime.getDate())}` +
    `T${twoDigits(localTime.getHours())}:${twoDigits(localTime.getMinutes())}:${twoDigits(localTime.getSeconds())}`;
  // The Android app formats the time with the "XXX" pattern, which writes a zero offset as "Z" instead of "+00:00".
  if (offsetMinutesEastOfUtc === 0) return `${localDateAndTime}Z`;
  const offsetSign = offsetMinutesEastOfUtc >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutesEastOfUtc);
  return (
    localDateAndTime +
    `${offsetSign}${twoDigits(Math.floor(absoluteOffsetMinutes / 60))}:${twoDigits(absoluteOffsetMinutes % 60)}`
  );
}

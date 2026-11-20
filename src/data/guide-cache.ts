// TODO: Validate
import { readGmValue, writeGmValue } from "../userscript/gm-values";
import {
  arrayOfObjects,
  arrayOfStrings,
  isJsonObject,
  type JsonObject,
  JsonShapeError,
  optionalNumber,
  optionalString,
  requiredString,
} from "./json-fields";
import { ALL_GUIDE_SCOPES, type GuideChannel, type GuideScope, type GuideVideo } from "./models";
import type { SerialTaskQueue } from "./task-queues";

const GUIDE_CACHE_STORAGE_KEY = "guideCache";

export interface CachedGuide {
  channels: GuideChannel[];
  favoriteChannelIds: string[];
  guideScopeToChannelIds: Partial<Record<GuideScope, string[]>>;
  updatedAt: number;
}

// TODO: Validate
export class GuideCache {
  private readonly backgroundWriteQueue: SerialTaskQueue;
  private pendingGuideCacheSaveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // TODO: Validate
  constructor(backgroundWriteQueue: SerialTaskQueue) {
    this.backgroundWriteQueue = backgroundWriteQueue;
  }

  // TODO: Validate
  async read(): Promise<CachedGuide | null> {
    const storedGuideCache = await readGmValue<unknown>(GUIDE_CACHE_STORAGE_KEY);
    return storedGuideCache === undefined || storedGuideCache === null
      ? null
      : cachedGuideFromStoredValue(storedGuideCache);
  }

  // TODO: Validate
  scheduleSave(currentCachedGuide: () => CachedGuide): void {
    if (this.pendingGuideCacheSaveTimeoutId !== null) clearTimeout(this.pendingGuideCacheSaveTimeoutId);
    this.pendingGuideCacheSaveTimeoutId = setTimeout(() => {
      this.pendingGuideCacheSaveTimeoutId = null;
      this.save(currentCachedGuide());
    }, 1000);
  }

  // TODO: Validate
  cancelPendingSaveAndDelete(): void {
    if (this.pendingGuideCacheSaveTimeoutId !== null) clearTimeout(this.pendingGuideCacheSaveTimeoutId);
    this.pendingGuideCacheSaveTimeoutId = null;
    void writeGmValue(GUIDE_CACHE_STORAGE_KEY, null);
  }

  // TODO: Validate
  private save(cachedGuide: CachedGuide): void {
    void this.backgroundWriteQueue.run(async () => {
      try {
        await writeGmValue(GUIDE_CACHE_STORAGE_KEY, cachedGuide);
      } catch (guideCacheError) {
        console.warn("Couldn't save the guide cache", guideCacheError);
      }
    });
  }
}

// TODO: Validate
/**
 * Read a guide cache saved by an earlier run, filling in defaults for missing fields the way the Android app reads its
 * cache file. Throws a JsonShapeError when the saved value or one of its channels or videos can't be read.
 */
export function cachedGuideFromStoredValue(storedGuideCache: unknown): CachedGuide {
  if (!isJsonObject(storedGuideCache)) throw new JsonShapeError("the guide cache is not an object");
  const guideScopeToChannelIdsJson = isJsonObject(storedGuideCache.guideScopeToChannelIds)
    ? storedGuideCache.guideScopeToChannelIds
    : {};
  const guideScopeToChannelIds: Partial<Record<GuideScope, string[]>> = {};
  for (const guideScope of ALL_GUIDE_SCOPES) {
    guideScopeToChannelIds[guideScope] = stringArrayOrEmpty(guideScopeToChannelIdsJson[guideScope]);
  }
  return {
    channels: objectArrayOrEmpty(storedGuideCache.channels).map(cachedGuideChannel),
    favoriteChannelIds: stringArrayOrEmpty(storedGuideCache.favoriteChannelIds),
    guideScopeToChannelIds,
    updatedAt: optionalNumber(storedGuideCache, "updatedAt") ?? 0,
  };
}

// TODO: Validate
function cachedGuideChannel(cachedChannelJson: JsonObject): GuideChannel {
  return {
    id: requiredString(cachedChannelJson, "id"),
    name: optionalString(cachedChannelJson, "name"),
    number: optionalNumber(cachedChannelJson, "number"),
    defaultOrder: optionalString(cachedChannelJson, "defaultOrder"),
    videos: objectArrayOrEmpty(cachedChannelJson.videos).map(cachedGuideVideo),
    imageUrl: optionalString(cachedChannelJson, "imageUrl"),
    hasMoreVideos: cachedChannelJson.hasMoreVideos === true,
    authorUsername: optionalString(cachedChannelJson, "authorUsername"),
  };
}

// TODO: Validate
function cachedGuideVideo(cachedVideoJson: JsonObject): GuideVideo {
  return {
    episodeId: requiredString(cachedVideoJson, "episodeId"),
    title: optionalString(cachedVideoJson, "title"),
    subtitle: optionalString(cachedVideoJson, "subtitle") ?? "",
    url: optionalString(cachedVideoJson, "url"),
    durationSeconds: optionalNumber(cachedVideoJson, "durationSeconds"),
    thumbnailUrl: optionalString(cachedVideoJson, "thumbnailUrl"),
    faviconUrl: optionalString(cachedVideoJson, "faviconUrl"),
    sourceKey: optionalString(cachedVideoJson, "sourceKey") ?? "",
    pluginKey: optionalString(cachedVideoJson, "pluginKey"),
    watched: cachedVideoJson.watched === true,
    watchCompleted: cachedVideoJson.watchCompleted === true,
    watchId: optionalString(cachedVideoJson, "watchId"),
    titleId: optionalString(cachedVideoJson, "titleId"),
    description: optionalString(cachedVideoJson, "description"),
  };
}

// TODO: Validate
function objectArrayOrEmpty(jsonValue: unknown): JsonObject[] {
  return Array.isArray(jsonValue) ? arrayOfObjects(jsonValue) : [];
}

// TODO: Validate
function stringArrayOrEmpty(jsonValue: unknown): string[] {
  return Array.isArray(jsonValue) ? arrayOfStrings(jsonValue) : [];
}

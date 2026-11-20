// TODO: Validate
import type { AccountSettingsRepository } from "./account-settings-repository";
import { ChannelSearchAndShowFilter } from "./channel-search-and-show-filter";
import { type CachedGuide, GuideCache } from "./guide-cache";
import { describeLoadError, errorMessage, isSignInRejectedError } from "./load-errors";
import type { LocalAppStorage } from "./local-app-storage";
import {
  ALL_GUIDE_SCOPES,
  type AutomaticRefreshResult,
  type ChannelEpisodesAction,
  type ChannelListItem,
  episodeSeedForChannel,
  type GuideChannel,
  type GuideScope,
  type GuideVideo,
  hasAutomaticSettings,
  type OrderSeeds,
} from "./models";
import { channelListQuery, PagedChannelList } from "./paged-channel-list";
import type { StreamChannelerApi } from "./stream-channeler-api";
import { ConcurrencyLimitedQueue, SerialTaskQueue } from "./task-queues";

const CHANNEL_PAGE_SIZE = 20;
const SHOWN_FAILED_CHANNEL_NAMES = 3;

export type GuideChangeListener = () => void;

// TODO: Validate
export class GuideRepository {
  private readonly api: StreamChannelerApi;
  private readonly preferences: LocalAppStorage;
  private readonly accountSettings: AccountSettingsRepository;
  private readonly coordinatorQueue = new SerialTaskQueue();
  private readonly channelFetchQueue = new ConcurrencyLimitedQueue(6);
  private readonly backgroundWriteQueue = new SerialTaskQueue();
  private readonly guideCache = new GuideCache(this.backgroundWriteQueue);
  private readonly channelsById = new Map<string, GuideChannel>();
  private readonly listeners = new Set<GuideChangeListener>();
  private readonly channelIdToRunningAction = new Map<string, ChannelEpisodesAction>();
  private readonly channelIdToFailedAction = new Map<string, ChannelEpisodesAction>();
  private readonly guideScopeToChannelList = new Map<GuideScope, PagedChannelList>();
  private refreshGeneration = 0;
  private hasStartedLoading = false;

  readonly channelSearchAndShowFilter = new ChannelSearchAndShowFilter();
  favoriteChannelIds = new Set<string>();
  updatedAt = 0;
  isRefreshing = false;
  lastRefreshErrorMessage: string | null = null;
  guideLoadProblems: string[] = [];
  isSignInExpired = false;

  // TODO: Validate
  constructor(api: StreamChannelerApi, preferences: LocalAppStorage, accountSettings: AccountSettingsRepository) {
    this.api = api;
    this.preferences = preferences;
    this.accountSettings = accountSettings;
  }

  // TODO: Validate
  get isWaitingForFirstGuide(): boolean {
    return this.guideScopeToChannelList.size === 0 && this.lastRefreshErrorMessage === null;
  }

  // TODO: Validate
  guideChannelList(guideScope: GuideScope): PagedChannelList | null {
    return this.guideScopeToChannelList.get(guideScope) ?? null;
  }

  // TODO: Validate
  channelsIn(channelList: PagedChannelList): GuideChannel[] {
    return [...channelList.channelIds].flatMap((channelId) => {
      const listedChannel = this.channelsById.get(channelId);
      return listedChannel === undefined ? [] : [listedChannel];
    });
  }

  // TODO: Validate
  findChannel(channelId: string): GuideChannel | null {
    return this.channelsById.get(channelId) ?? null;
  }

  // TODO: Validate
  runningChannelAction(channelId: string): ChannelEpisodesAction | null {
    return this.channelIdToRunningAction.get(channelId) ?? null;
  }

  // TODO: Validate
  failedChannelAction(channelId: string): ChannelEpisodesAction | null {
    return this.channelIdToFailedAction.get(channelId) ?? null;
  }

  // TODO: Validate
  async afterCachedGuideLoads(): Promise<void> {
    await this.coordinatorQueue.run(async () => undefined);
  }

  // TODO: Validate
  async finishPendingWrites(maximumWait: number): Promise<void> {
    await Promise.race([
      this.backgroundWriteQueue.run(async () => undefined),
      new Promise<void>((resolveAfterWaiting) => setTimeout(resolveAfterWaiting, maximumWait)),
    ]);
  }

  // TODO: Validate
  addListener(listener: GuideChangeListener): void {
    this.listeners.add(listener);
  }

  // TODO: Validate
  removeListener(listener: GuideChangeListener): void {
    this.listeners.delete(listener);
  }

  // TODO: Validate
  startLoadingIfNeeded(): void {
    if (this.hasStartedLoading) return;
    this.hasStartedLoading = true;
    void this.coordinatorQueue.run(async () => {
      let cachedGuide: CachedGuide | null = null;
      try {
        cachedGuide = await this.guideCache.read();
      } catch (guideCacheError) {
        console.warn("Couldn't read the guide cache", guideCacheError);
      }
      if (cachedGuide !== null && this.channelsById.size === 0) {
        for (const cachedChannel of cachedGuide.channels) this.channelsById.set(cachedChannel.id, cachedChannel);
        this.favoriteChannelIds = new Set(cachedGuide.favoriteChannelIds);
        this.restoreGuideChannelLists(cachedGuide.guideScopeToChannelIds);
        this.updatedAt = cachedGuide.updatedAt;
        this.notifyListeners();
      }
      this.loadWhatChangedSinceTheGuideWasCached(cachedGuide !== null);
    });
  }

  // TODO: Validate
  private loadWhatChangedSinceTheGuideWasCached(hasCachedGuide: boolean): void {
    if (!this.preferences.isSignedIn) {
      if (!hasCachedGuide) this.refresh();
      return;
    }
    if (!hasCachedGuide) {
      this.refresh(true);
      void this.coordinatorQueue.run(() => this.accountSettings.loadSignedInUserIfReachable());
      return;
    }
    void this.coordinatorQueue.run(async () => {
      let automaticRefreshResult: AutomaticRefreshResult | null = null;
      try {
        await this.accountSettings.loadSignedInUserIfReachable();
        const accountRefreshSettings = this.preferences.accountRefreshSettings;
        automaticRefreshResult =
          accountRefreshSettings !== null && !hasAutomaticSettings(accountRefreshSettings)
            ? null
            : await this.api.runAutomaticRefresh();
      } catch (automaticRefreshError) {
        console.warn("Couldn't run the automatic refreshes", automaticRefreshError);
      }
      if (
        !hasCachedGuide ||
        automaticRefreshResult?.refreshedChannels === true ||
        automaticRefreshResult?.changedEveryChannelsEpisodes === true
      ) {
        this.refresh();
      } else if (automaticRefreshResult !== null && automaticRefreshResult.changedEpisodesChannelIds.length > 0) {
        this.checkChannelsForNewEpisodesLoadedFromServer(automaticRefreshResult.changedEpisodesChannelIds);
      }
    });
  }

  // TODO: Validate
  private checkChannelsForNewEpisodesLoadedFromServer(channelIds: string[]): void {
    this.runChannelEpisodesAction(channelIds, "CHECK_FOR_NEW_EPISODES", async (channelsToReload) =>
      Object.fromEntries(channelsToReload.map((channel) => [channel.id, null])),
    );
  }

  // TODO: Validate
  refreshAndShuffleAll(onFailure: (failureMessage: string) => void): void {
    const isSignedIn = this.preferences.isSignedIn;
    void this.coordinatorQueue.run(async () => {
      try {
        if (isSignedIn) {
          await this.api.refreshAndShuffleAll();
        } else {
          this.preferences.advanceLocalMinimumEpisodeSeed();
          this.preferences.advanceLocalChannelOrderSeed();
        }
        this.refresh();
      } catch (refreshAndShuffleError) {
        console.warn("Couldn't refresh and shuffle everything", refreshAndShuffleError);
        onFailure(`Couldn't refresh and shuffle everything: ${errorMessage(refreshAndShuffleError)}`);
      }
    });
  }

  // TODO: Validate
  private restoreGuideChannelLists(guideScopeToChannelIds: Partial<Record<GuideScope, string[]>>): void {
    for (const guideScope of ALL_GUIDE_SCOPES) {
      this.replaceGuideChannelList(guideScope, guideScopeToChannelIds[guideScope] ?? []);
    }
  }

  // TODO: Validate
  private replaceGuideChannelList(guideScope: GuideScope, channelIds: string[]): PagedChannelList {
    const replacedChannelList = this.guideScopeToChannelList.get(guideScope);
    if (replacedChannelList !== undefined) replacedChannelList.isDiscarded = true;
    const replacementChannelList = new PagedChannelList([channelListQuery(guideScope)]);
    for (const channelId of channelIds) replacementChannelList.channelIds.add(channelId);
    this.guideScopeToChannelList.set(guideScope, replacementChannelList);
    return replacementChannelList;
  }

  // TODO: Validate
  clearForAccountChange(): void {
    this.refreshGeneration++;
    this.channelsById.clear();
    this.favoriteChannelIds = new Set();
    for (const guideChannelList of this.guideScopeToChannelList.values()) guideChannelList.isDiscarded = true;
    this.guideScopeToChannelList.clear();
    this.updatedAt = 0;
    this.isRefreshing = false;
    this.lastRefreshErrorMessage = null;
    this.guideLoadProblems = [];
    this.isSignInExpired = false;
    this.channelSearchAndShowFilter.clearSearchAndShowFilter();
    this.channelIdToRunningAction.clear();
    this.channelIdToFailedAction.clear();
    this.hasStartedLoading = false;
    this.guideCache.cancelPendingSaveAndDelete();
    this.notifyListeners();
  }

  // TODO: Validate
  refresh(runsAutomaticRefresh = false): void {
    const generation = ++this.refreshGeneration;
    this.isRefreshing = true;
    this.lastRefreshErrorMessage = null;
    this.notifyListeners();
    const watchedEpisodeIds = this.preferences.readWatchedEpisodeIds();
    const isSignedIn = this.preferences.isSignedIn;
    const refreshedGuideScopes = guideScopesFor(isSignedIn);
    void this.coordinatorQueue.run(async () => {
      const refreshLoadErrors: unknown[] = [];
      const refreshLoadProblems: string[] = [];
      try {
        const sentOrderSeeds = isSignedIn ? null : this.preferences.loadLocalSeeds();
        const guideScopeToFirstPageResult = new Map<GuideScope, ChannelListItem[] | null>();
        for (const guideScope of refreshedGuideScopes) {
          try {
            guideScopeToFirstPageResult.set(
              guideScope,
              await this.api.fetchChannelList(
                guideScope,
                0,
                CHANNEL_PAGE_SIZE,
                sentOrderSeeds?.channelOrderSeed ?? null,
                [],
                null,
                runsAutomaticRefresh && isSignedIn && guideScope === refreshedGuideScopes[0],
              ),
            );
          } catch (firstPageError) {
            if (guideScope === "PUBLIC") throw firstPageError;
            console.warn(`Couldn't load ${guideScope} channels`, firstPageError);
            refreshLoadErrors.push(firstPageError);
            const failedListName = guideScope === "FAVORITES" ? "favorite" : "own";
            refreshLoadProblems.push(
              `Couldn't load your ${failedListName} channels: ${describeLoadError(firstPageError)}.`,
            );
            guideScopeToFirstPageResult.set(guideScope, null);
          }
        }
        const listItemsInGuideOrder = uniqueById(
          [...guideScopeToFirstPageResult.values()].flatMap((firstPageListItems) => firstPageListItems ?? []),
        );
        const failedChannelIds = new Set<string>();
        const loadedChannels = await this.fetchChannelsWithVideos(
          listItemsInGuideOrder,
          sentOrderSeeds,
          watchedEpisodeIds,
          {
            onChannelFailed: (failedListItem) => failedChannelIds.add(failedListItem.id),
            onChannelsFailed: (failedChannelsProblem, failedChannelErrors) => {
              refreshLoadErrors.push(...failedChannelErrors);
              refreshLoadProblems.push(failedChannelsProblem);
            },
            onChannelLoaded: (loadedChannel) => {
              if (generation !== this.refreshGeneration) return;
              this.channelsById.set(loadedChannel.id, loadedChannel);
              this.notifyListeners();
            },
          },
        );
        if (generation !== this.refreshGeneration) return;
        const keptChannelIdsFromFailedLists = new Set<string>();
        for (const [guideScope, firstPageListItems] of guideScopeToFirstPageResult) {
          if (firstPageListItems !== null) continue;
          for (const keptChannelId of this.guideScopeToChannelList.get(guideScope)?.channelIds ?? []) {
            keptChannelIdsFromFailedLists.add(keptChannelId);
          }
        }
        const loadedChannelIds = new Set(loadedChannels.map((loadedChannel) => loadedChannel.id));
        const channelIdsInGuideOrder = [
          ...new Set([...keptChannelIdsFromFailedLists, ...listItemsInGuideOrder.map((listItem) => listItem.id)]),
        ];
        const refreshedChannelsById = new Map<string, GuideChannel>();
        for (const channelId of channelIdsInGuideOrder) {
          const isKeptFromBeforeRefresh =
            failedChannelIds.has(channelId) || keptChannelIdsFromFailedLists.has(channelId);
          if (!loadedChannelIds.has(channelId) && !isKeptFromBeforeRefresh) continue;
          const refreshedChannel = this.channelsById.get(channelId);
          if (refreshedChannel !== undefined) refreshedChannelsById.set(channelId, refreshedChannel);
        }
        this.channelsById.clear();
        for (const [channelId, refreshedChannel] of refreshedChannelsById)
          this.channelsById.set(channelId, refreshedChannel);
        for (const [guideScope, firstPageListItems] of guideScopeToFirstPageResult) {
          if (firstPageListItems === null) continue;
          const firstPageChannelIds = firstPageListItems.map((listItem) => listItem.id);
          const replacementChannelList = this.replaceGuideChannelList(guideScope, firstPageChannelIds);
          replacementChannelList.nextPageIndex = 1;
          replacementChannelList.loadStatus = firstPageListItems.length === 0 ? "EXHAUSTED" : "IDLE";
          if (guideScope === "FAVORITES") this.favoriteChannelIds = new Set(firstPageChannelIds);
        }
        for (const droppedGuideScope of ALL_GUIDE_SCOPES.filter(
          (guideScope) => !refreshedGuideScopes.includes(guideScope),
        )) {
          const droppedChannelList = this.guideScopeToChannelList.get(droppedGuideScope);
          if (droppedChannelList !== undefined) droppedChannelList.isDiscarded = true;
          this.guideScopeToChannelList.delete(droppedGuideScope);
        }
        this.guideLoadProblems = [...refreshLoadProblems];
        this.isSignInExpired = isSignedIn && refreshLoadErrors.some(isSignInRejectedError);
        this.updatedAt = Date.now();
        this.isRefreshing = false;
        this.scheduleGuideCacheSave();
        this.notifyListeners();
        const channelSearchAndShowFilter = this.channelSearchAndShowFilter;
        if (channelSearchAndShowFilter.searchChannelList !== null) {
          this.searchChannels(
            channelSearchAndShowFilter.channelSearchQuery,
            channelSearchAndShowFilter.channelSearchScope,
          );
        }
        if (channelSearchAndShowFilter.showFilterTitleId !== null) {
          this.filterChannelsByShow(
            channelSearchAndShowFilter.showFilterTitleId,
            channelSearchAndShowFilter.showFilterName,
          );
        }
      } catch (refreshError) {
        console.warn("Couldn't refresh the guide", refreshError);
        if (generation !== this.refreshGeneration) return;
        this.isRefreshing = false;
        this.lastRefreshErrorMessage = describeLoadError(refreshError);
        this.guideLoadProblems = [...refreshLoadProblems];
        this.isSignInExpired = isSignedIn && [...refreshLoadErrors, refreshError].some(isSignInRejectedError);
        this.notifyListeners();
      }
    });
  }

  // TODO: Validate
  loadMoreChannels(channelList: PagedChannelList): void {
    if (channelList.isDiscarded) return;
    if (channelList.loadStatus === "LOADING" || channelList.loadStatus === "EXHAUSTED") return;
    if (this.isRefreshing && [...this.guideScopeToChannelList.values()].includes(channelList)) return;
    channelList.loadStatus = "LOADING";
    channelList.lastErrorMessage = null;
    this.notifyListeners();
    const knownChannelIds = new Set(this.channelsById.keys());
    const listedChannelIds = new Set(channelList.channelIds);
    const firstQueryIndexToTry = channelList.queryIndex;
    const firstPageIndexToTry = channelList.nextPageIndex;
    const watchedEpisodeIds = this.preferences.readWatchedEpisodeIds();
    void this.coordinatorQueue.run(async () => {
      try {
        const loadMoreProblems: string[] = [];
        const sentOrderSeeds = this.orderSeedsToSend();
        let queryIndex = firstQueryIndexToTry;
        let pageIndex = firstPageIndexToTry;
        let pageAttemptCount = 0;
        while (queryIndex < channelList.queries.length && pageAttemptCount < 8) {
          pageAttemptCount++;
          const pagedQuery = channelList.queries[queryIndex];
          if (pagedQuery === undefined) break;
          const pageListItems = await this.api.fetchChannelList(
            pagedQuery.guideScope,
            pageIndex * CHANNEL_PAGE_SIZE,
            CHANNEL_PAGE_SIZE,
            sentOrderSeeds?.channelOrderSeed ?? null,
            pagedQuery.filterOptions,
            pagedQuery.titleId,
          );
          if (pageListItems.length === 0) {
            queryIndex++;
            pageIndex = 0;
            continue;
          }
          pageIndex++;
          const pageNewlyListedItems = pageListItems.filter((listItem) => {
            if (listedChannelIds.has(listItem.id)) return false;
            listedChannelIds.add(listItem.id);
            return true;
          });
          const pageNewlyListedChannelIds = pageNewlyListedItems.map((listItem) => listItem.id);
          if (!channelList.isDiscarded) {
            for (const newlyListedChannelId of pageNewlyListedChannelIds)
              channelList.channelIds.add(newlyListedChannelId);
            if (pagedQuery.guideScope === "FAVORITES") {
              this.favoriteChannelIds = new Set([...this.favoriteChannelIds, ...pageNewlyListedChannelIds]);
            }
            this.notifyListeners();
          }
          const pageAlreadyLoadedCount = pageNewlyListedItems.filter((listItem) =>
            knownChannelIds.has(listItem.id),
          ).length;
          const pageUnloadedItems = pageNewlyListedItems.filter((listItem) => {
            if (knownChannelIds.has(listItem.id)) return false;
            knownChannelIds.add(listItem.id);
            return true;
          });
          const pageLoadedChannels = await this.fetchChannelsWithVideos(
            pageUnloadedItems,
            sentOrderSeeds,
            watchedEpisodeIds,
            {
              onChannelsFailed: (failedChannelsProblem) => loadMoreProblems.push(failedChannelsProblem),
              onChannelLoaded: (loadedChannel) => {
                if (channelList.isDiscarded) return;
                if (this.channelsById.has(loadedChannel.id)) return;
                this.channelsById.set(loadedChannel.id, loadedChannel);
                this.notifyListeners();
              },
            },
          );
          if (pageAlreadyLoadedCount + pageLoadedChannels.length > 0) break;
        }
        if (channelList.isDiscarded) return;
        channelList.queryIndex = queryIndex;
        channelList.nextPageIndex = pageIndex;
        channelList.loadStatus = queryIndex >= channelList.queries.length ? "EXHAUSTED" : "IDLE";
        this.guideLoadProblems = [...new Set([...this.guideLoadProblems, ...loadMoreProblems])];
        this.scheduleGuideCacheSave();
        this.notifyListeners();
      } catch (loadMoreError) {
        console.warn("Couldn't load more channels", loadMoreError);
        if (channelList.isDiscarded) return;
        channelList.loadStatus = "FAILED";
        channelList.lastErrorMessage = describeLoadError(loadMoreError);
        this.notifyListeners();
      }
    });
  }

  // TODO: Validate
  searchChannels(searchQuery: string, guideScope: GuideScope): void {
    const newSearchChannelList = this.channelSearchAndShowFilter.replaceSearch(searchQuery, guideScope);
    if (newSearchChannelList === null) {
      this.notifyListeners();
      return;
    }
    this.loadMoreChannels(newSearchChannelList);
  }

  // TODO: Validate
  filterChannelsByShow(titleId: string, showName: string): void {
    this.loadMoreChannels(
      this.channelSearchAndShowFilter.replaceShowFilter(titleId, showName, guideScopesFor(this.preferences.isSignedIn)),
    );
  }

  // TODO: Validate
  clearShowFilter(): void {
    this.channelSearchAndShowFilter.clearShowFilter();
    this.notifyListeners();
  }

  // TODO: Validate
  private orderSeedsToSend(): OrderSeeds | null {
    return this.preferences.isSignedIn ? null : this.preferences.loadLocalSeeds();
  }

  // TODO: Validate
  resortChannels(channelIds: string[]): void {
    const isSignedIn = this.preferences.isSignedIn;
    this.runChannelEpisodesAction(channelIds, "RESORT", async (channelsToResort) => {
      if (isSignedIn) {
        await this.api.advanceChannelEpisodeSeeds(channelsToResort.map((channel) => channel.id));
        return Object.fromEntries(channelsToResort.map((channel) => [channel.id, null]));
      }
      const orderSeeds = this.preferences.loadLocalSeeds();
      return Object.fromEntries(
        channelsToResort.map((channel) => {
          const rotatedEpisodeSeed = episodeSeedForChannel(orderSeeds, channel.id) + 1;
          this.preferences.saveLocalChannelEpisodeSeed(channel.id, rotatedEpisodeSeed);
          return [channel.id, rotatedEpisodeSeed];
        }),
      );
    });
  }

  // TODO: Validate
  checkChannelsForNewEpisodes(channelIds: string[]): void {
    this.runChannelEpisodesAction(channelIds, "CHECK_FOR_NEW_EPISODES", async (channelsToCheck) => {
      await this.api.forgetStoredEpisodeOrders(channelsToCheck.map((channel) => channel.id));
      const sentOrderSeeds = this.orderSeedsToSend();
      return Object.fromEntries(
        channelsToCheck.map((channel) => [
          channel.id,
          sentOrderSeeds === null ? null : episodeSeedForChannel(sentOrderSeeds, channel.id),
        ]),
      );
    });
  }

  // TODO: Validate
  resortAllChannels(onFailure: (failureMessage: string) => void): void {
    void this.coordinatorQueue.run(async () => {
      try {
        if (this.preferences.isSignedIn) {
          await this.api.advanceEveryChannelEpisodeSeed();
        } else {
          this.preferences.advanceLocalMinimumEpisodeSeed();
        }
        this.refresh();
      } catch (resortError) {
        console.warn("Couldn't resort every channel", resortError);
        onFailure(`Couldn't resort every channel: ${errorMessage(resortError)}`);
      }
    });
  }

  // TODO: Validate
  refreshChannelOrder(onFailure: (failureMessage: string) => void): void {
    const isSignedIn = this.preferences.isSignedIn;
    void this.coordinatorQueue.run(async () => {
      try {
        if (isSignedIn) {
          await this.api.advanceChannelOrderSeed();
        } else {
          this.preferences.advanceLocalChannelOrderSeed();
        }
        this.refresh();
      } catch (channelOrderError) {
        console.warn("Couldn't refresh the channel order", channelOrderError);
        onFailure(`Couldn't refresh the channel order: ${errorMessage(channelOrderError)}`);
      }
    });
  }

  // TODO: Validate
  checkAllChannelsForNewEpisodes(onFailure: (failureMessage: string) => void): void {
    void this.coordinatorQueue.run(async () => {
      try {
        await this.api.forgetStoredEpisodeOrders(null);
        this.refresh();
      } catch (checkError) {
        console.warn("Couldn't check every channel for new episodes", checkError);
        onFailure(`Couldn't check every channel for new episodes: ${errorMessage(checkError)}`);
      }
    });
  }

  // TODO: Validate
  private runChannelEpisodesAction(
    channelIds: string[],
    action: ChannelEpisodesAction,
    channelIdToEpisodeSeedFor: (channelsForAction: GuideChannel[]) => Promise<Record<string, number | null>>,
  ): void {
    const channelsForAction = channelIds.flatMap((channelId) => {
      const channelForAction = this.channelsById.get(channelId);
      if (channelForAction === undefined || this.channelIdToRunningAction.has(channelId)) return [];
      return [channelForAction];
    });
    if (channelsForAction.length === 0) return;
    for (const channel of channelsForAction) {
      this.channelIdToRunningAction.set(channel.id, action);
      this.channelIdToFailedAction.delete(channel.id);
    }
    this.notifyListeners();
    const watchedEpisodeIds = this.preferences.readWatchedEpisodeIds();
    void this.coordinatorQueue.run(async () => {
      let channelIdToEpisodeOrderSeed: Record<string, number | null>;
      try {
        channelIdToEpisodeOrderSeed = await channelIdToEpisodeSeedFor(channelsForAction);
      } catch (seedError) {
        console.warn("Couldn't prepare the channels' episode seeds", seedError);
        for (const channel of channelsForAction) {
          this.channelIdToRunningAction.delete(channel.id);
          this.channelIdToFailedAction.set(channel.id, action);
        }
        this.notifyListeners();
        return;
      }
      for (const channel of channelsForAction) {
        void this.channelFetchQueue.run(async () => {
          try {
            const reloadedVideosPage = await this.api.fetchChannelVideos(
              channel.id,
              channelIdToEpisodeOrderSeed[channel.id] ?? null,
            );
            this.channelIdToRunningAction.delete(channel.id);
            const currentChannel = this.channelsById.get(channel.id);
            if (currentChannel !== undefined) {
              this.channelsById.set(channel.id, {
                ...currentChannel,
                videos: withLocallyWatchedVideos(reloadedVideosPage.videos, watchedEpisodeIds),
                hasMoreVideos: reloadedVideosPage.hasMoreVideos,
              });
              this.scheduleGuideCacheSave();
            }
            this.notifyListeners();
          } catch (reloadError) {
            console.warn(`Couldn't reload ${channel.id}'s episodes`, reloadError);
            this.channelIdToRunningAction.delete(channel.id);
            this.channelIdToFailedAction.set(channel.id, action);
            this.notifyListeners();
          }
        });
      }
    });
  }

  // TODO: Validate
  loadMoreVideos(channelId: string): void {
    const channel = this.channelsById.get(channelId);
    if (channel === undefined) return;
    if (!channel.hasMoreVideos || this.channelIdToRunningAction.has(channelId)) return;
    this.channelIdToRunningAction.set(channelId, "LOAD_MORE_EPISODES");
    this.channelIdToFailedAction.delete(channelId);
    this.notifyListeners();
    const generation = this.refreshGeneration;
    const watchedEpisodeIds = this.preferences.readWatchedEpisodeIds();
    const loadedVideoCount = channel.videos.length;
    void this.coordinatorQueue.run(async () => {
      try {
        const sentOrderSeeds = this.orderSeedsToSend();
        const nextVideosPage = await this.api.fetchChannelVideos(
          channel.id,
          sentOrderSeeds === null ? null : episodeSeedForChannel(sentOrderSeeds, channel.id),
          loadedVideoCount,
        );
        if (this.channelIdToRunningAction.get(channelId) === "LOAD_MORE_EPISODES") {
          this.channelIdToRunningAction.delete(channelId);
        }
        if (generation !== this.refreshGeneration) return;
        const currentChannel = this.channelsById.get(channelId);
        if (currentChannel !== undefined && currentChannel.videos.length === loadedVideoCount) {
          const loadedEpisodeIds = new Set(currentChannel.videos.map((video) => video.episodeId));
          this.channelsById.set(channelId, {
            ...currentChannel,
            videos: [
              ...currentChannel.videos,
              ...withLocallyWatchedVideos(
                nextVideosPage.videos.filter((video) => !loadedEpisodeIds.has(video.episodeId)),
                watchedEpisodeIds,
              ),
            ],
            hasMoreVideos: nextVideosPage.hasMoreVideos,
          });
          this.scheduleGuideCacheSave();
        }
        this.notifyListeners();
      } catch (loadMoreError) {
        console.warn(`Couldn't load more of ${channelId}'s episodes`, loadMoreError);
        if (this.channelIdToRunningAction.get(channelId) === "LOAD_MORE_EPISODES") {
          this.channelIdToRunningAction.delete(channelId);
        }
        this.channelIdToFailedAction.set(channelId, "LOAD_MORE_EPISODES");
        this.notifyListeners();
      }
    });
  }

  // TODO: Validate
  markVideoWatched(episodeId: string, channelId: string, onFailure: (failureMessage: string) => void): void {
    this.preferences.rememberWatchedEpisode(episodeId);
    this.updateVideoInEveryChannel(episodeId, (video) => ({ ...video, watched: true }));
    if (!this.preferences.isSignedIn) return;
    void this.backgroundWriteQueue.run(async () => {
      try {
        const incompleteWatchId =
          (await this.api.fetchIncompleteWatchId(episodeId)) ??
          (await this.api.markEpisodeWatched(episodeId, false, channelId));
        this.updateVideoInEveryChannel(episodeId, (video) => ({
          ...video,
          watchCompleted: false,
          watchId: incompleteWatchId,
        }));
      } catch (markWatchedError) {
        console.warn(`Couldn't mark ${episodeId} watched`, markWatchedError);
        if (isSignInRejectedError(markWatchedError)) {
          this.isSignInExpired = true;
          this.notifyListeners();
        }
        onFailure(`Couldn't mark the last video watched on your account: ${describeLoadError(markWatchedError)}.`);
      }
    });
  }

  // TODO: Validate
  markVideoStartedOrCompleted(
    episodeId: string,
    completed: boolean,
    channelId: string,
    onFailure: (failureMessage: string) => void,
  ): void {
    void this.backgroundWriteQueue.run(async () => {
      try {
        const createdWatchId = await this.api.markEpisodeWatched(episodeId, completed, channelId);
        this.preferences.rememberWatchedEpisode(episodeId);
        this.updateVideoInEveryChannel(episodeId, (video) => ({
          ...video,
          watched: true,
          watchCompleted: completed,
          watchId: createdWatchId,
        }));
      } catch (createWatchError) {
        const attemptedWatchStatus = completed ? "completed" : "started";
        onFailure(`Couldn't mark the episode ${attemptedWatchStatus}: ${errorMessage(createWatchError)}`);
      }
    });
  }

  // TODO: Validate
  completeStartedVideo(startedVideo: GuideVideo, channelId: string, onFailure: (failureMessage: string) => void): void {
    void this.backgroundWriteQueue.run(async () => {
      try {
        const incompleteWatchId =
          startedVideo.watchId ?? (await this.api.fetchIncompleteWatchId(startedVideo.episodeId));
        let completedWatchId: string;
        if (incompleteWatchId === null) {
          completedWatchId = await this.api.markEpisodeWatched(startedVideo.episodeId, true, channelId);
        } else {
          await this.api.completeWatch(incompleteWatchId);
          completedWatchId = incompleteWatchId;
        }
        this.updateVideoInEveryChannel(startedVideo.episodeId, (video) => ({
          ...video,
          watched: true,
          watchCompleted: true,
          watchId: completedWatchId,
        }));
      } catch (completeWatchError) {
        onFailure(`Couldn't mark the episode completed: ${errorMessage(completeWatchError)}`);
      }
    });
  }

  // TODO: Validate
  deleteStartedVideoWatch(startedVideo: GuideVideo, onFailure: (failureMessage: string) => void): void {
    void this.backgroundWriteQueue.run(async () => {
      try {
        const incompleteWatchId =
          startedVideo.watchId ?? (await this.api.fetchIncompleteWatchId(startedVideo.episodeId));
        if (incompleteWatchId !== null) await this.api.deleteWatch(incompleteWatchId);
        this.preferences.forgetWatchedEpisode(startedVideo.episodeId);
        this.updateVideoInEveryChannel(startedVideo.episodeId, (video) => ({
          ...video,
          watched: false,
          watchCompleted: false,
          watchId: null,
        }));
      } catch (deleteWatchError) {
        onFailure(`Couldn't delete the watch: ${errorMessage(deleteWatchError)}`);
      }
    });
  }

  // TODO: Validate
  setChannelFavorite(channelId: string, shouldBeFavorite: boolean, onFailure: (failureMessage: string) => void): void {
    void this.backgroundWriteQueue.run(async () => {
      try {
        if (shouldBeFavorite) {
          await this.api.favoriteChannel(channelId);
        } else {
          await this.api.unfavoriteChannel(channelId);
        }
        const updatedFavoriteChannelIds = new Set(this.favoriteChannelIds);
        if (shouldBeFavorite) {
          updatedFavoriteChannelIds.add(channelId);
        } else {
          updatedFavoriteChannelIds.delete(channelId);
        }
        this.favoriteChannelIds = updatedFavoriteChannelIds;
        const favoriteListChannelIds = this.guideScopeToChannelList.get("FAVORITES")?.channelIds;
        if (favoriteListChannelIds !== undefined) {
          if (shouldBeFavorite) {
            favoriteListChannelIds.add(channelId);
          } else {
            favoriteListChannelIds.delete(channelId);
          }
        }
        this.scheduleGuideCacheSave();
        this.notifyListeners();
      } catch (favoriteChangeError) {
        const failedFavoriteChange = shouldBeFavorite ? "add the channel to" : "remove the channel from";
        onFailure(`Couldn't ${failedFavoriteChange} your favorites: ${errorMessage(favoriteChangeError)}`);
      }
    });
  }

  // TODO: Validate
  private updateVideoInEveryChannel(
    episodeId: string,
    updateMatchingVideo: (matchingVideo: GuideVideo) => GuideVideo,
  ): void {
    let didChangeAnyVideo = false;
    for (const [channelId, channel] of [...this.channelsById.entries()]) {
      let didChangeChannelVideo = false;
      const updatedVideos = channel.videos.map((video) => {
        if (video.episodeId !== episodeId) return video;
        const updatedVideo = updateMatchingVideo(video);
        if (!haveSameFields(updatedVideo, video)) didChangeChannelVideo = true;
        return updatedVideo;
      });
      // An update that leaves every video as it was, such as marking a watched video watched again, does not
      // save the cache or notify listeners, like the Android app's data class comparison.
      if (!didChangeChannelVideo) continue;
      this.channelsById.set(channelId, { ...channel, videos: updatedVideos });
      didChangeAnyVideo = true;
    }
    if (didChangeAnyVideo) {
      this.scheduleGuideCacheSave();
      this.notifyListeners();
    }
  }

  // TODO: Validate
  private async fetchChannelsWithVideos(
    listItems: ChannelListItem[],
    sentOrderSeeds: OrderSeeds | null,
    watchedEpisodeIds: Set<string>,
    channelLoadCallbacks: {
      onChannelFailed?: (failedListItem: ChannelListItem) => void;
      onChannelsFailed?: (failedChannelsProblem: string, failedChannelErrors: unknown[]) => void;
      onChannelLoaded: (loadedChannel: GuideChannel) => void;
    },
  ): Promise<GuideChannel[]> {
    const channelLoadResults = await Promise.allSettled(
      listItems.map((listItem) =>
        this.channelFetchQueue.run(async () => {
          const channelEpisodeSeed =
            sentOrderSeeds === null ? null : episodeSeedForChannel(sentOrderSeeds, listItem.id);
          const usesBundledVideos =
            listItem.bundledVideosPage !== null && (sentOrderSeeds === null || channelEpisodeSeed === 0);
          const channelVideosPage =
            usesBundledVideos && listItem.bundledVideosPage !== null
              ? listItem.bundledVideosPage
              : await this.api.fetchChannelVideos(listItem.id, channelEpisodeSeed);
          const loadedChannel: GuideChannel = {
            id: listItem.id,
            name: listItem.customName ?? listItem.name,
            number: listItem.customChannelNumber ?? listItem.channelNumber,
            defaultOrder: listItem.defaultOrder,
            videos: withLocallyWatchedVideos(channelVideosPage.videos, watchedEpisodeIds),
            imageUrl:
              listItem.imageId !== null && listItem.customName === null
                ? this.api.channelImageUrl(listItem.imageId)
                : null,
            hasMoreVideos: channelVideosPage.hasMoreVideos,
            authorUsername: listItem.authorUsername,
          };
          if (loadedChannel.videos.length > 0) channelLoadCallbacks.onChannelLoaded(loadedChannel);
          return loadedChannel;
        }),
      ),
    );
    const failedListItemToError = new Map<ChannelListItem, unknown>();
    const loadedChannels: GuideChannel[] = [];
    channelLoadResults.forEach((channelLoadResult, listItemIndex) => {
      const listItem = listItems[listItemIndex];
      if (listItem === undefined) return;
      if (channelLoadResult.status === "rejected") {
        console.warn(`Couldn't load ${listItem.id}'s videos`, channelLoadResult.reason);
        failedListItemToError.set(listItem, channelLoadResult.reason);
        channelLoadCallbacks.onChannelFailed?.(listItem);
        return;
      }
      if (channelLoadResult.value.videos.length > 0) loadedChannels.push(channelLoadResult.value);
    });
    if (failedListItemToError.size > 0) {
      const failedChannelNames = [...failedListItemToError.keys()].map(
        (failedListItem) => failedListItem.customName ?? failedListItem.name ?? "Untitled channel",
      );
      const shownFailedChannelNames =
        failedChannelNames.slice(0, SHOWN_FAILED_CHANNEL_NAMES).join(", ") +
        (failedChannelNames.length > SHOWN_FAILED_CHANNEL_NAMES
          ? ` and ${failedChannelNames.length - SHOWN_FAILED_CHANNEL_NAMES} more`
          : "");
      const firstChannelError = [...failedListItemToError.values()][0];
      channelLoadCallbacks.onChannelsFailed?.(
        `Couldn't load ${failedChannelNames.length} channel${failedChannelNames.length === 1 ? "" : "s"} ` +
          `(${shownFailedChannelNames}): ${describeLoadError(firstChannelError)}.`,
        [...failedListItemToError.values()],
      );
    }
    return loadedChannels;
  }

  // TODO: Validate
  private notifyListeners(): void {
    for (const listener of [...this.listeners]) listener();
  }

  // TODO: Validate
  private scheduleGuideCacheSave(): void {
    this.guideCache.scheduleSave(() => this.currentCachedGuide());
  }

  // TODO: Validate
  private currentCachedGuide(): CachedGuide {
    const guideScopeToChannelIds: Partial<Record<GuideScope, string[]>> = {};
    for (const [guideScope, guideChannelList] of this.guideScopeToChannelList) {
      guideScopeToChannelIds[guideScope] = [...guideChannelList.channelIds];
    }
    return {
      channels: [...this.channelsById.values()],
      favoriteChannelIds: [...this.favoriteChannelIds],
      guideScopeToChannelIds,
      updatedAt: this.updatedAt,
    };
  }
}

// TODO: Validate
function guideScopesFor(isSignedIn: boolean): GuideScope[] {
  return isSignedIn ? ["FAVORITES", "OWNED", "PUBLIC"] : ["PUBLIC"];
}

// TODO: Validate
function uniqueById(listItems: ChannelListItem[]): ChannelListItem[] {
  const seenChannelIds = new Set<string>();
  return listItems.filter((listItem) => {
    if (seenChannelIds.has(listItem.id)) return false;
    seenChannelIds.add(listItem.id);
    return true;
  });
}

// TODO: Validate
function withLocallyWatchedVideos(videos: GuideVideo[], watchedEpisodeIds: Set<string>): GuideVideo[] {
  return videos.map((video) => (watchedEpisodeIds.has(video.episodeId) ? { ...video, watched: true } : video));
}

// TODO: Validate
function haveSameFields(updatedVideo: GuideVideo, originalVideo: GuideVideo): boolean {
  const videoFieldNames = Object.keys(updatedVideo) as (keyof GuideVideo)[];
  return (
    videoFieldNames.length === Object.keys(originalVideo).length &&
    videoFieldNames.every((videoFieldName) => updatedVideo[videoFieldName] === originalVideo[videoFieldName])
  );
}

// TODO: Validate

import type { StoredValueKey } from "../../data/local-app-storage";
import {
  type ChannelRefreshSettings,
  formatChannelNumber,
  type GuideChannel,
  type GuideScope,
  type GuideVideo,
  nextPlayableVideo,
} from "../../data/models";
import type { PagedChannelList } from "../../data/paged-channel-list";
import { type ActivePlayback, type PlaybackOutcome, playingVideoOf } from "../../playback/playback-monitor";
import {
  activePlaybackFor,
  nextVideoInPlayedOrLatestOrder,
  playVideoInThisTab,
  previousVideoInPlayedOrLatestOrder,
  stopMonitoring,
} from "../../playback/video-player";
import { StatusMessageOverlay } from "../../screenautomation/status-message-overlay";
import type { StreamChannelerApp } from "../../stream-channeler-app";
import {
  findStreamingSite,
  streamingSiteForHost,
  streamingSiteName,
  videoUrlHost,
} from "../../streamingsites/streaming-site";
import type { AppView } from "../common/app-view";
import { showActionMenu, showDialog, showErrorPopup } from "../common/dialogs";
import { clickFocusedElement, moveFocusAmong, type RemoteAction } from "../common/remote-input";
import { actionButton, setShown, textInput, textLabel } from "../common/ui";
import { UpNextView } from "../upnext/up-next-view";
import { type GuideGridListener, GuideGridView } from "./guide-grid-view";
import { type GuideRow, guideWindowStart, type ScheduledVideo, scheduleChannelVideos } from "./guide-row";
import { formatSlotTime, formatVideoDuration } from "./guide-time-formatting";

const PENDING_WRITES_WAIT_BEFORE_LEAVING = 4_000;

type MenuItem = { label: string; action: () => void };

// TODO: Validate
export class GuideView implements AppView, GuideGridListener {
  readonly rootElement: HTMLElement;
  private readonly app: StreamChannelerApp;
  private readonly guideGridView: GuideGridView;
  private readonly detailThumbnailImage: HTMLImageElement;
  private readonly detailChannelNameText: HTMLDivElement;
  private readonly detailTitleText: HTMLDivElement;
  private readonly detailSubtitleText: HTMLDivElement;
  private readonly detailTimingText: HTMLDivElement;
  private readonly detailSourceFaviconImage: HTMLImageElement;
  private readonly detailSourceText: HTMLDivElement;
  private readonly detailActionHintText: HTMLDivElement;
  private readonly detailDescriptionText: HTMLDivElement;
  private readonly statusMessageOverlay = new StatusMessageOverlay();
  // Load problems stay shown while they last, so they get their own corner and do not hide the status messages.
  private readonly guideLoadProblemOverlay = new StatusMessageOverlay("bottom-left");
  private readonly refreshButton: HTMLButtonElement;
  private readonly searchInput: HTMLInputElement;
  private readonly publicChannelsButton: HTMLButtonElement;
  private readonly favoriteChannelsButton: HTMLButtonElement;
  private readonly ownedChannelsButton: HTMLButtonElement;
  private readonly showFilterButton: HTMLButtonElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly toolbarElements: HTMLElement[];
  private lastFocusedToolbarElement: HTMLElement;
  private shownChannelIds: string[] = [];
  private hasAppliedInitialFocus = false;
  private hasShownSignInExpiredDialog = false;
  private shownWindowStart = 0;
  private isShown = false;
  private searchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private guideClockTimeoutId: ReturnType<typeof setTimeout> | null = null;
  // TODO: Validate
  private readonly rebuildGuideRowsOnGuideChange = () => this.rebuildGuideRows();
  // TODO: Validate
  private readonly onStoredValuesChanged = (changedKeys: StoredValueKey[]) => {
    if (changedKeys.includes("pendingPlaybackOutcome")) this.consumePendingPlaybackOutcome();
    if (changedKeys.includes("activePlayback")) this.rebuildGuideRows();
  };
  // TODO: Validate
  private readonly onVisibilityChanged = () => {
    if (document.visibilityState === "visible") this.onGuideVisible();
  };

  // TODO: Validate
  constructor(app: StreamChannelerApp) {
    this.app = app;
    this.rootElement = document.createElement("div");
    this.rootElement.className = "guide-screen";
    this.detailThumbnailImage = document.createElement("img");
    this.detailThumbnailImage.className = "detail-thumbnail";
    this.detailThumbnailImage.alt = "";
    this.detailChannelNameText = textLabel("", "detail-channel-name");
    this.detailTitleText = textLabel("", "detail-title");
    this.detailSubtitleText = textLabel("", "detail-subtitle");
    this.detailTimingText = textLabel("", "detail-timing");
    this.detailSourceFaviconImage = document.createElement("img");
    this.detailSourceFaviconImage.className = "detail-source-favicon";
    this.detailSourceFaviconImage.alt = "";
    this.detailSourceText = textLabel("", "detail-source");
    this.detailActionHintText = textLabel("", "detail-action-hint");
    this.detailDescriptionText = textLabel("", "detail-description");
    setShown(this.detailDescriptionText, false);

    const detailSourceRow = document.createElement("div");
    detailSourceRow.className = "detail-source-row";
    detailSourceRow.append(this.detailSourceFaviconImage, this.detailSourceText);
    const detailInfoColumn = document.createElement("div");
    detailInfoColumn.className = "detail-info-column";
    detailInfoColumn.append(
      this.detailChannelNameText,
      this.detailTitleText,
      this.detailSubtitleText,
      this.detailTimingText,
      detailSourceRow,
      this.detailActionHintText,
    );
    const detailPanel = document.createElement("div");
    detailPanel.className = "detail-panel";
    detailPanel.append(this.detailThumbnailImage, detailInfoColumn);
    const statusPanel = document.createElement("div");
    statusPanel.className = "status-panel";
    statusPanel.append(this.detailDescriptionText);
    const topSection = document.createElement("div");
    topSection.className = "guide-top-section";
    topSection.append(detailPanel, statusPanel);

    this.searchInput = textInput("Search channels", "search");
    this.searchInput.className = "text-input search-input";
    this.searchInput.addEventListener("input", () => this.onSearchTextChanged());
    this.publicChannelsButton = actionButton("Public Channels", () => this.selectGuideScope("PUBLIC"));
    this.favoriteChannelsButton = actionButton("★ Favorites", () => this.selectGuideScope("FAVORITES"));
    this.ownedChannelsButton = actionButton("Owned", () => this.selectGuideScope("OWNED"));
    this.showFilterButton = actionButton("", () => this.clearShowFilter());
    this.refreshButton = actionButton("Refresh", () => this.showRefreshMenu());
    this.settingsButton = actionButton("Settings", () => this.app.openSettings());
    this.toolbarElements = [
      this.searchInput,
      this.publicChannelsButton,
      this.favoriteChannelsButton,
      this.ownedChannelsButton,
      this.showFilterButton,
      this.refreshButton,
      this.settingsButton,
    ];
    this.lastFocusedToolbarElement = this.refreshButton;
    for (const toolbarElement of this.toolbarElements) {
      toolbarElement.addEventListener("focus", () => {
        this.lastFocusedToolbarElement = toolbarElement;
      });
    }
    const toolbarRow = document.createElement("div");
    toolbarRow.className = "guide-toolbar";
    toolbarRow.append(...this.toolbarElements);

    this.guideGridView = new GuideGridView(this, app.imageLoader);
    this.rootElement.append(topSection, toolbarRow, this.guideGridView.canvasElement);
  }

  // TODO: Validate
  onShown(): void {
    this.isShown = true;
    this.app.guideRepository.startLoadingIfNeeded();
    this.app.guideRepository.addListener(this.rebuildGuideRowsOnGuideChange);
    this.app.preferences.addChangeListener(this.onStoredValuesChanged);
    document.addEventListener("visibilitychange", this.onVisibilityChanged);
    this.rebuildGuideRows();
    this.scheduleGuideClockTick();
    this.onGuideVisible();
    void this.app.guideRepository.afterCachedGuideLoads().then(() => this.consumePendingPlaybackOutcome());
    if (this.hasAppliedInitialFocus) this.guideGridView.requestFocus();
  }

  // TODO: Validate
  onHidden(): void {
    this.isShown = false;
    this.app.guideRepository.removeListener(this.rebuildGuideRowsOnGuideChange);
    this.app.preferences.removeChangeListener(this.onStoredValuesChanged);
    document.removeEventListener("visibilitychange", this.onVisibilityChanged);
    // The overlays sit on the page itself, so they are taken down when another screen replaces the guide.
    this.statusMessageOverlay.hide();
    this.guideLoadProblemOverlay.hide();
    if (this.guideClockTimeoutId !== null) clearTimeout(this.guideClockTimeoutId);
    this.guideClockTimeoutId = null;
  }

  // TODO: Validate
  private onGuideVisible(): void {
    const activePlayback = this.app.preferences.activePlayback;
    const timeSinceLaunch = Date.now() - (activePlayback?.launchedAt ?? 0);
    if (activePlayback?.isMonitoring === true && timeSinceLaunch > 3_000) {
      void stopMonitoring(this.app.preferences);
    }
  }

  // TODO: Validate
  private scheduleGuideClockTick(): void {
    if (this.guideClockTimeoutId !== null) clearTimeout(this.guideClockTimeoutId);
    this.guideClockTimeoutId = setTimeout(() => {
      if (guideWindowStart(Date.now()) !== this.shownWindowStart) {
        this.rebuildGuideRows();
      } else {
        this.guideGridView.invalidate();
      }
      this.scheduleGuideClockTick();
    }, 60_000);
  }

  // TODO: Validate
  handleRemoteAction(remoteAction: RemoteAction): boolean {
    switch (remoteAction) {
      case "menu":
        if (!(this.guideGridView.hasFocus() && this.guideGridView.openFocusedVideoMenu())) this.app.openSettings();
        return true;
      case "settings":
        this.app.openSettings();
        return true;
      case "guide":
        this.guideGridView.requestFocus();
        return true;
      case "search":
        this.searchInput.focus();
        return true;
      case "refresh":
        this.app.guideRepository.refresh();
        return true;
      default:
        break;
    }
    if (this.guideGridView.hasFocus()) {
      if (this.guideGridView.handleRemoteAction(remoteAction)) return true;
      if (remoteAction === "up") {
        this.focusToolbar();
        return true;
      }
      if (remoteAction === "back") {
        this.refreshButton.focus();
        return true;
      }
      return false;
    }
    if (this.toolbarElements.includes(document.activeElement as HTMLElement)) {
      switch (remoteAction) {
        case "left":
          return moveFocusAmong(this.toolbarElements, -1);
        case "right":
          return moveFocusAmong(this.toolbarElements, 1);
        case "down":
          this.guideGridView.requestFocus();
          return true;
        case "select":
          if (document.activeElement === this.searchInput) {
            this.guideGridView.requestFocus();
            return true;
          }
          return clickFocusedElement();
        case "back":
          if (document.activeElement === this.searchInput) {
            this.refreshButton.focus();
            return true;
          }
          return false;
        default:
          return false;
      }
    }
    if (["up", "down", "left", "right", "select"].includes(remoteAction)) {
      this.guideGridView.requestFocus();
      return true;
    }
    return false;
  }

  // TODO: Validate
  private focusToolbar(): void {
    if (this.lastFocusedToolbarElement.offsetParent !== null) {
      this.lastFocusedToolbarElement.focus();
    } else {
      this.refreshButton.focus();
    }
  }

  // TODO: Validate
  private onSearchTextChanged(): void {
    if (this.searchTimeoutId !== null) clearTimeout(this.searchTimeoutId);
    this.searchTimeoutId = null;
    if (this.searchInput.value.trim().length === 0) {
      this.searchChannels();
      return;
    }
    this.searchTimeoutId = setTimeout(() => this.searchChannels(), 400);
    this.rebuildGuideRows();
  }

  // TODO: Validate
  private searchChannels(): void {
    this.app.guideRepository.searchChannels(this.searchInput.value.trim(), this.effectiveGuideScope());
  }

  // TODO: Validate
  private effectiveGuideScope(): GuideScope {
    return this.app.preferences.isSignedIn ? this.app.preferences.guideScope : "PUBLIC";
  }

  // TODO: Validate
  private shownChannelList(guideScope: GuideScope, searchQuery: string): PagedChannelList | null {
    const guideRepository = this.app.guideRepository;
    const channelSearchAndShowFilter = guideRepository.channelSearchAndShowFilter;
    if (channelSearchAndShowFilter.showFilterTitleId !== null) return channelSearchAndShowFilter.showFilterChannelList;
    if (searchQuery.length === 0) return guideRepository.guideChannelList(guideScope);
    if (
      searchQuery === channelSearchAndShowFilter.channelSearchQuery &&
      guideScope === channelSearchAndShowFilter.channelSearchScope
    ) {
      return channelSearchAndShowFilter.searchChannelList;
    }
    return null;
  }

  // TODO: Validate
  private rebuildGuideRows(): void {
    if (!this.isShown) return;
    const guideRepository = this.app.guideRepository;
    const preferences = this.app.preferences;
    const guideScope = this.effectiveGuideScope();
    const searchQuery = this.searchInput.value.trim();
    const isShowFilterActive = guideRepository.channelSearchAndShowFilter.showFilterTitleId !== null;
    const shownChannelList = this.shownChannelList(guideScope, searchQuery);
    const orderedChannels = (shownChannelList === null ? [] : guideRepository.channelsIn(shownChannelList)).filter(
      (channel) => channel.videos.length > 0,
    );
    this.shownChannelIds = orderedChannels.map((channel) => channel.id);
    const activePlayback = preferences.activePlayback;
    const currentChannel = orderedChannels.find((channel) => channel.id === activePlayback?.channelId);
    const guideRows: GuideRow[] = [];
    if (currentChannel !== undefined) guideRows.push(this.guideRowFor(currentChannel, true));
    for (const channel of orderedChannels) guideRows.push(this.guideRowFor(channel, false));
    const windowStart = guideWindowStart(Date.now());
    this.shownWindowStart = windowStart;
    this.rootElement.style.setProperty("--guide-details-height-percent", String(preferences.guideDetailsHeightPercent));
    this.guideGridView.isCondensed = preferences.showsCondensedGuide;
    this.guideGridView.showsSourceLogos = preferences.showsGuideSourceLogos;
    this.guideGridView.playingEpisodeId = activePlayback?.playingEpisodeId ?? null;
    this.guideGridView.footerMessage = this.footerMessageFor(shownChannelList, orderedChannels.length > 0);
    this.guideGridView.emptyMessage = this.emptyGuideMessage(guideScope, searchQuery);
    this.guideGridView.setGuideRows(guideRows, windowStart);

    if (guideRepository.isRefreshing) {
      this.refreshButton.textContent = "Refreshing…";
    } else if (guideRepository.updatedAt > 0) {
      this.refreshButton.textContent = `Refresh · Updated ${formatSlotTime(guideRepository.updatedAt)}`;
    } else {
      this.refreshButton.textContent = "Refresh";
    }
    this.renderGuideLoadProblems(guideRows.length > 0);
    const isSignedIn = preferences.isSignedIn;
    this.publicChannelsButton.classList.toggle("is-activated", guideScope === "PUBLIC");
    this.favoriteChannelsButton.classList.toggle("is-activated", guideScope === "FAVORITES");
    this.ownedChannelsButton.classList.toggle("is-activated", guideScope === "OWNED");
    for (const signedInOnlyButton of [
      this.publicChannelsButton,
      this.favoriteChannelsButton,
      this.ownedChannelsButton,
    ]) {
      setShown(signedInOnlyButton, isSignedIn);
    }
    this.showFilterButton.textContent = `All Channels with ${guideRepository.channelSearchAndShowFilter.showFilterName}`;
    this.showFilterButton.classList.toggle("is-activated", isShowFilterActive);
    setShown(this.showFilterButton, isShowFilterActive);

    if (!this.hasAppliedInitialFocus && guideRows.length > 0) {
      this.hasAppliedInitialFocus = true;
      if (activePlayback !== null)
        this.guideGridView.focusEpisode(activePlayback.channelId, activePlayback.playingEpisodeId);
      this.guideGridView.requestFocus();
    }
  }

  // TODO: Validate
  private guideRowFor(channel: GuideChannel, isCurrentChannelRow: boolean): GuideRow {
    const guideRepository = this.app.guideRepository;
    const preferences = this.app.preferences;
    const runningChannelAction = guideRepository.runningChannelAction(channel.id);
    let channelStatusText: string | null = null;
    switch (runningChannelAction ?? guideRepository.failedChannelAction(channel.id)) {
      case "RESORT":
        channelStatusText = runningChannelAction === null ? "Couldn't resort the episodes" : "Resorting episodes…";
        break;
      case "CHECK_FOR_NEW_EPISODES":
        channelStatusText =
          runningChannelAction === null ? "Couldn't check for new episodes" : "Checking for new episodes…";
        break;
      case "LOAD_MORE_EPISODES":
        channelStatusText = runningChannelAction === null ? "Couldn't load more episodes" : "Loading more episodes…";
        break;
      default:
        break;
    }
    return {
      channel,
      scheduledVideos: scheduleChannelVideos(
        channel.videos,
        preferences.minimumVideoMinutes,
        preferences.sizesGuideVideosByText
          ? (video) =>
              this.guideGridView.videoTextFittingMinutes(
                video,
                preferences.showsCondensedGuide,
                preferences.showsGuideSourceLogos,
              )
          : null,
      ),
      isCurrentChannelRow,
      isFavorite: guideRepository.favoriteChannelIds.has(channel.id),
      channelStatusText,
      isLoadingMoreVideos: runningChannelAction === "LOAD_MORE_EPISODES",
    };
  }

  // TODO: Validate
  private footerMessageFor(shownChannelList: PagedChannelList | null, hasGuideRows: boolean): string | null {
    if (shownChannelList === null || !hasGuideRows || this.app.guideRepository.isRefreshing) return null;
    switch (shownChannelList.loadStatus) {
      case "IDLE":
        return "Press Down for more channels";
      case "LOADING":
        return "Loading more channels…";
      case "FAILED":
        return "Couldn't load more channels. Press Down to retry.";
      case "EXHAUSTED":
        return "No more channels";
    }
  }

  // TODO: Validate
  private emptyGuideMessage(guideScope: GuideScope, searchQuery: string): string {
    const guideRepository = this.app.guideRepository;
    const channelSearchAndShowFilter = guideRepository.channelSearchAndShowFilter;
    const showFilterName = channelSearchAndShowFilter.showFilterName;
    const lastShowFilterErrorMessage = channelSearchAndShowFilter.lastShowFilterErrorMessage;
    const isShowFilterActive = channelSearchAndShowFilter.showFilterTitleId !== null;
    if (isShowFilterActive && channelSearchAndShowFilter.isLoadingShowFilter) {
      return `Finding channels with ${showFilterName}…`;
    }
    if (isShowFilterActive && lastShowFilterErrorMessage !== null) {
      return `Couldn't find channels with ${showFilterName}: ${lastShowFilterErrorMessage}. Select All Channels with ${showFilterName} to go back.`;
    }
    if (isShowFilterActive) return `No channels with ${showFilterName} found.`;
    if (
      searchQuery.length > 0 &&
      (channelSearchAndShowFilter.isSearchingChannels || searchQuery !== channelSearchAndShowFilter.channelSearchQuery)
    ) {
      return "Searching channels…";
    }
    if (searchQuery.length > 0 && channelSearchAndShowFilter.lastSearchErrorMessage !== null) {
      return `Couldn't search channels: ${channelSearchAndShowFilter.lastSearchErrorMessage}. Select Refresh to try again.`;
    }
    if (guideRepository.isRefreshing || guideRepository.isWaitingForFirstGuide) return "Loading the guide…";
    if (guideRepository.lastRefreshErrorMessage !== null) {
      return `Couldn't load the guide: ${guideRepository.lastRefreshErrorMessage}. Select Refresh to try again.`;
    }
    if (searchQuery.length > 0) return "No channels match your search.";
    if (guideRepository.isSignInExpired && guideScope !== "PUBLIC") {
      return "Your sign-in has expired. Press Menu and sign in again to see these channels.";
    }
    if (guideScope === "FAVORITES") return "No favorite channels yet. Favorite channels on streamchanneler.com.";
    if (guideScope === "OWNED") return "No channels of your own yet. Make one on streamchanneler.com.";
    return "No channels with videos yet.";
  }

  // TODO: Validate
  private renderGuideLoadProblems(hasGuideRows: boolean): void {
    const guideRepository = this.app.guideRepository;
    const guideLoadProblemLines: string[] = [];
    if (guideRepository.isSignInExpired) {
      guideLoadProblemLines.push(
        "Your sign-in has expired, so your favorites, your own channels and your episode shuffles can't load. Press Menu and sign in again.",
      );
    }
    const lastRefreshErrorMessage = guideRepository.lastRefreshErrorMessage;
    if (lastRefreshErrorMessage !== null && hasGuideRows && !guideRepository.isRefreshing) {
      const savedGuideTime = guideRepository.updatedAt > 0 ? ` from ${formatSlotTime(guideRepository.updatedAt)}` : "";
      guideLoadProblemLines.push(
        `Couldn't refresh the guide: ${lastRefreshErrorMessage}. Showing the saved guide${savedGuideTime}. Select Refresh to try again.`,
      );
    }
    guideLoadProblemLines.push(
      ...guideRepository.guideLoadProblems.filter(
        (guideLoadProblem) =>
          !guideRepository.isSignInExpired || !guideLoadProblem.includes("your sign-in has expired"),
      ),
    );
    if (guideLoadProblemLines.length > 0) {
      this.guideLoadProblemOverlay.showUntilHidden(guideLoadProblemLines.join("\n"));
    } else {
      this.guideLoadProblemOverlay.hide();
    }
    if (!guideRepository.isSignInExpired) {
      this.hasShownSignInExpiredDialog = false;
    } else if (!this.hasShownSignInExpiredDialog) {
      this.hasShownSignInExpiredDialog = true;
      showDialog(this.app.remoteInput, {
        title: "Sign-in expired",
        message:
          "Your Stream Channeler sign-in has expired, so your favorites, your own channels and your " +
          "episode shuffles can't load. Public channels still work. Sign in again to get them back.",
        buttons: [{ label: "Sign in again", onChosen: () => this.app.signOutAndShowLogin() }, { label: "Later" }],
      });
    }
  }

  // TODO: Validate
  private selectGuideScope(guideScope: GuideScope): void {
    this.app.preferences.guideScope = guideScope;
    if (this.searchInput.value.trim().length > 0) this.searchChannels();
    this.rebuildGuideRows();
  }

  // TODO: Validate
  private showRefreshMenu(): void {
    const guideRepository = this.app.guideRepository;
    // TODO: Validate
    const showFailure = (failureMessage: string) => this.showErrorPopup(failureMessage);
    const refreshMenuItems: MenuItem[] = [
      { label: "Refresh and Shuffle All", action: () => guideRepository.refreshAndShuffleAll(showFailure) },
      { label: "Refresh Channels", action: () => guideRepository.refresh() },
    ];
    if (this.app.preferences.isSignedIn) {
      refreshMenuItems.push(
        {
          label: "Refresh Episodes: Shown Channels",
          action: () => guideRepository.checkChannelsForNewEpisodes(this.shownChannelIds),
        },
        {
          label: "Refresh Episodes: Every Channel",
          action: () => guideRepository.checkAllChannelsForNewEpisodes(showFailure),
        },
        {
          label: "Refresh User Settings",
          action: () =>
            this.app.accountSettings.refreshUserSettings(
              () => this.showStatusMessage("User settings refreshed."),
              showFailure,
            ),
        },
      );
    }
    refreshMenuItems.push(
      { label: "Shuffle Channel Order", action: () => guideRepository.refreshChannelOrder(showFailure) },
      { label: "Shuffle Episodes: Shown Channels", action: () => guideRepository.resortChannels(this.shownChannelIds) },
      { label: "Shuffle Episodes: Every Channel", action: () => guideRepository.resortAllChannels(showFailure) },
    );
    showActionMenu(this.app.remoteInput, "Refresh", refreshMenuItems);
  }

  // TODO: Validate
  private showChannelSettings(channel: GuideChannel): void {
    const accountRefreshSettings = this.app.preferences.accountRefreshSettings;
    if (accountRefreshSettings === null) return;
    const channelRefreshSettings: ChannelRefreshSettings = accountRefreshSettings.channelIdToRefreshSettings[
      channel.id
    ] ?? { refreshesEpisodesAutomatically: null, shufflesEpisodesAutomatically: null };
    // TODO: Validate
    const saveChannelRefreshSettings = (updatedChannelRefreshSettings: ChannelRefreshSettings) =>
      this.app.accountSettings.updateChannelRefreshSettings(
        channel.id,
        updatedChannelRefreshSettings,
        () => this.showChannelSettings(channel),
        (failureMessage) => this.showErrorPopup(failureMessage),
      );
    showDialog(this.app.remoteInput, {
      title: `My Settings for ${channel.name ?? "this channel"}`,
      menuItems: [
        {
          label: `Refresh Episodes: ${channelSettingLabel(
            channelRefreshSettings.refreshesEpisodesAutomatically,
            accountRefreshSettings.refreshesEpisodesAutomatically,
          )}`,
          onChosen: () =>
            saveChannelRefreshSettings({
              ...channelRefreshSettings,
              refreshesEpisodesAutomatically: nextChannelSetting(channelRefreshSettings.refreshesEpisodesAutomatically),
            }),
        },
        {
          label: `Shuffle Episodes: ${channelSettingLabel(
            channelRefreshSettings.shufflesEpisodesAutomatically,
            accountRefreshSettings.shufflesEpisodesAutomatically,
          )}`,
          onChosen: () =>
            saveChannelRefreshSettings({
              ...channelRefreshSettings,
              shufflesEpisodesAutomatically: nextChannelSetting(channelRefreshSettings.shufflesEpisodesAutomatically),
            }),
        },
      ],
      buttons: [{ label: "Close" }],
    });
  }

  // TODO: Validate
  private showStatusMessage(messageText: string): void {
    this.statusMessageOverlay.show(messageText, 8_000);
  }

  // TODO: Validate
  private showErrorPopup(errorMessage: string): void {
    if (!this.rootElement.isConnected) return;
    showErrorPopup(this.app.remoteInput, errorMessage);
  }

  // TODO: Validate
  onVideoFocused(_guideRow: GuideRow, scheduledVideo: ScheduledVideo, windowStart: number): void {
    const video = scheduledVideo.video;
    const videoStart = windowStart + scheduledVideo.startMinute * 60_000;
    const videoEnd = videoStart + scheduledVideo.minutes * 60_000;
    setShown(this.detailChannelNameText, false);
    this.detailTitleText.textContent = video.title ?? "";
    const videoDescription = video.description?.trim() ?? "";
    this.detailDescriptionText.textContent = videoDescription;
    this.detailDescriptionText.scrollTop = 0;
    setShown(this.detailDescriptionText, videoDescription.length > 0);
    this.detailSubtitleText.textContent = video.subtitle;
    setShown(this.detailSubtitleText, video.subtitle.length > 0);
    let watchStatus: string | null = null;
    if (video.watched) watchStatus = video.watchCompleted ? "Completed" : "Started";
    this.detailTimingText.textContent = [
      `${formatSlotTime(videoStart)} - ${formatSlotTime(videoEnd)}`,
      video.durationSeconds === null ? null : formatVideoDuration(video.durationSeconds),
      watchStatus,
    ]
      .filter((timingPart) => timingPart !== null)
      .join(" · ");
    this.detailSourceText.textContent = streamingSiteName(video);
    this.app.imageLoader.loadInto(this.detailSourceFaviconImage, video.faviconUrl);
    this.app.imageLoader.loadInto(this.detailThumbnailImage, video.thumbnailUrl);
    this.detailActionHintText.textContent = video.url === null ? "This video has no link to play." : "";
    setShown(this.detailActionHintText, video.url === null);
  }

  // TODO: Validate
  onChannelLabelFocused(guideRow: GuideRow): void {
    const channelNumberText = formatChannelNumber(guideRow.channel.number);
    this.detailChannelNameText.textContent = channelNumberText === null ? "Channel" : `Channel ${channelNumberText}`;
    setShown(this.detailChannelNameText, true);
    setShown(this.detailDescriptionText, false);
    const channelName = guideRow.channel.name ?? "Untitled channel";
    this.detailTitleText.replaceChildren();
    if (guideRow.isFavorite) {
      const favoriteStar = document.createElement("span");
      favoriteStar.className = "favorite-star";
      favoriteStar.textContent = "★ ";
      this.detailTitleText.append(favoriteStar);
    }
    this.detailTitleText.append(channelName);
    const channelAuthorUsername = guideRow.channel.authorUsername;
    this.detailSubtitleText.textContent = channelAuthorUsername === null ? "" : `by ${channelAuthorUsername}`;
    setShown(this.detailSubtitleText, channelAuthorUsername !== null);
    this.detailTimingText.textContent = "";
    this.detailSourceText.textContent = "";
    setShown(this.detailSourceFaviconImage, false);
    this.app.imageLoader.loadInto(this.detailThumbnailImage, guideRow.scheduledVideos[0]?.video.thumbnailUrl ?? null);
    this.detailActionHintText.textContent = guideRow.channelStatusText ?? "";
    setShown(this.detailActionHintText, guideRow.channelStatusText !== null);
  }

  // TODO: Validate
  onVideoChosen(guideRow: GuideRow, scheduledVideo: ScheduledVideo): void {
    this.playVideo(guideRow.channel, scheduledVideo.video);
  }

  // TODO: Validate
  onVideoMenuRequested(guideRow: GuideRow, scheduledVideo: ScheduledVideo): void {
    const video = scheduledVideo.video;
    const isSignedIn = this.app.preferences.isSignedIn;
    const isVideoCompleted = video.watched && video.watchCompleted;
    const guideRepository = this.app.guideRepository;
    // TODO: Validate
    const showFailure = (failureMessage: string) => this.showErrorPopup(failureMessage);
    const videoTitleId = video.titleId;
    const showName = video.title ?? "this show";
    const findShowMenuItems: MenuItem[] =
      videoTitleId === null
        ? []
        : [
            {
              label: `Find All Channels with ${showName}`,
              action: () => this.showChannelsWithShow(videoTitleId, showName),
            },
          ];
    let watchStatusMenuItems: MenuItem[] = [];
    if (isSignedIn && !isVideoCompleted && video.watched) {
      watchStatusMenuItems = [
        {
          label: "Mark as Completed",
          action: () => guideRepository.completeStartedVideo(video, guideRow.channel.id, showFailure),
        },
        { label: "Delete Watch", action: () => guideRepository.deleteStartedVideoWatch(video, showFailure) },
      ];
    } else if (isSignedIn && !isVideoCompleted) {
      watchStatusMenuItems = [
        {
          label: "Mark as Started",
          action: () =>
            guideRepository.markVideoStartedOrCompleted(video.episodeId, false, guideRow.channel.id, showFailure),
        },
        {
          label: "Mark as Completed",
          action: () =>
            guideRepository.markVideoStartedOrCompleted(video.episodeId, true, guideRow.channel.id, showFailure),
        },
      ];
    }
    const testBumperMenuItem: MenuItem = {
      label: "Test Bumper",
      action: () => this.testUpNextBumper(guideRow.channel, video),
    };
    showActionMenu(
      this.app.remoteInput,
      [video.title ?? "Untitled episode", video.subtitle].filter((titlePart) => titlePart.length > 0).join(" · "),
      [...watchStatusMenuItems, ...findShowMenuItems, testBumperMenuItem],
    );
  }

  // TODO: Validate
  private showChannelsWithShow(titleId: string, showName: string): void {
    if (this.searchInput.value.length > 0) {
      this.searchInput.value = "";
      // Setting the value from code does not fire an input event, so the search is cleared here the way typing would.
      this.onSearchTextChanged();
    }
    this.app.guideRepository.filterChannelsByShow(titleId, showName);
    this.guideGridView.requestFocus();
  }

  // TODO: Validate
  private clearShowFilter(): void {
    this.app.guideRepository.clearShowFilter();
    this.guideGridView.requestFocus();
  }

  // TODO: Validate
  onChannelLabelChosen(guideRow: GuideRow): void {
    const guideRepository = this.app.guideRepository;
    const channelId = guideRow.channel.id;
    // TODO: Validate
    const showFailure = (failureMessage: string) => this.showErrorPopup(failureMessage);
    if (!this.app.preferences.isSignedIn) {
      guideRepository.resortChannels([channelId]);
      return;
    }
    const favoriteMenuItem: MenuItem = guideRow.isFavorite
      ? {
          label: "Remove from Favorites",
          action: () => guideRepository.setChannelFavorite(channelId, false, showFailure),
        }
      : { label: "Add to Favorites", action: () => guideRepository.setChannelFavorite(channelId, true, showFailure) };
    showActionMenu(this.app.remoteInput, guideRow.channel.name ?? "Untitled channel", [
      { label: "Shuffle Episodes", action: () => guideRepository.resortChannels([channelId]) },
      { label: "Refresh Episodes", action: () => guideRepository.checkChannelsForNewEpisodes([channelId]) },
      favoriteMenuItem,
      { label: "My Settings for This Channel", action: () => this.showChannelSettings(guideRow.channel) },
    ]);
  }

  // TODO: Validate
  onLoadMoreVideosFocused(guideRow: GuideRow): void {
    this.detailChannelNameText.textContent = guideRow.channel.name ?? "Untitled channel";
    setShown(this.detailChannelNameText, true);
    setShown(this.detailDescriptionText, false);
    this.detailTitleText.textContent = "Load more episodes";
    this.detailSubtitleText.textContent = `${guideRow.scheduledVideos.length} videos loaded`;
    setShown(this.detailSubtitleText, true);
    this.detailTimingText.textContent = "";
    this.detailSourceText.textContent = "";
    setShown(this.detailSourceFaviconImage, false);
    setShown(this.detailThumbnailImage, false);
    setShown(this.detailActionHintText, true);
    this.detailActionHintText.textContent =
      guideRow.channelStatusText ?? "Press Select to load more of this channel's episodes";
  }

  // TODO: Validate
  onLoadMoreVideosChosen(guideRow: GuideRow): void {
    this.app.guideRepository.loadMoreVideos(guideRow.channel.id);
  }

  // TODO: Validate
  onNearLastRow(): void {
    const shownChannelList = this.shownChannelList(this.effectiveGuideScope(), this.searchInput.value.trim());
    if (shownChannelList !== null) this.app.guideRepository.loadMoreChannels(shownChannelList);
  }

  // TODO: Validate
  private playVideo(channel: GuideChannel, video: GuideVideo): void {
    void this.launchVideo(channel, video);
  }

  // TODO: Validate
  private async launchVideo(channel: GuideChannel, video: GuideVideo): Promise<void> {
    const videoStreamingSite = findStreamingSite(video);
    const activePlayback = activePlaybackFor(channel, video, videoStreamingSite?.pluginKey ?? null);
    const videoTitle = video.title ?? "the video";
    const videoLaunchLink = video.url;
    if (videoLaunchLink === null) {
      this.showStatusMessage("This video has no link to play.");
      return;
    }
    const videoHost = videoUrlHost(video);
    const canWatchVideoPage =
      videoStreamingSite !== null && videoHost !== null && streamingSiteForHost(videoHost) !== null;
    this.showStatusMessage(`Opening ${videoTitle}…`);
    this.markStartedVideoWatchedIfEnabled(channel, video);
    await this.app.guideRepository.finishPendingWrites(PENDING_WRITES_WAIT_BEFORE_LEAVING);
    const videoLaunchResult = await playVideoInThisTab(
      this.app.preferences,
      activePlayback,
      videoLaunchLink,
      canWatchVideoPage,
    );
    if (!videoLaunchResult.launched) this.showStatusMessage(videoLaunchResult.reason);
  }

  // TODO: Validate
  private markStartedVideoWatchedIfEnabled(channel: GuideChannel, video: GuideVideo): void {
    if (!this.app.preferences.marksStartedVideosWatched) return;
    this.app.guideRepository.markVideoWatched(video.episodeId, channel.id, (failureMessage) =>
      this.showErrorPopup(failureMessage),
    );
  }

  // TODO: Validate
  private markFinishedVideoCompletedIfEnabled(finishedPlayback: ActivePlayback): void {
    if (!this.app.preferences.marksFinishedVideosCompleted || !this.app.preferences.isSignedIn) return;
    const finishedVideo = playingVideoOf(finishedPlayback);
    if (finishedVideo === null) return;
    this.app.guideRepository.completeStartedVideo(
      { ...finishedVideo, watchId: null },
      finishedPlayback.channelId,
      (failureMessage) => this.showErrorPopup(failureMessage),
    );
  }

  // TODO: Validate
  private consumePendingPlaybackOutcome(): void {
    if (!this.isShown) return;
    const pendingPlaybackOutcome = this.app.preferences.pendingPlaybackOutcome;
    if (pendingPlaybackOutcome === null) return;
    void this.app.preferences.savePendingPlaybackOutcome(null);
    this.handlePlaybackOutcome(pendingPlaybackOutcome.playbackOutcome);
  }

  // TODO: Validate
  private handlePlaybackOutcome(playbackOutcome: PlaybackOutcome): void {
    const endedPlayback = this.app.preferences.activePlayback;
    if (endedPlayback === null) return;
    const endedVideoTitle = playingVideoOf(endedPlayback)?.title ?? "the video";
    this.hasAppliedInitialFocus = true;
    this.rebuildGuideRows();
    this.guideGridView.focusEpisode(endedPlayback.channelId, endedPlayback.playingEpisodeId);
    this.guideGridView.requestFocus();
    if (playbackOutcome === "skippedToNext" || playbackOutcome === "skippedToPrevious") {
      this.playSkippedToVideo(endedPlayback, playbackOutcome);
      return;
    }
    if (playbackOutcome !== "finished") {
      this.showStatusMessage(`Stopped watching ${endedVideoTitle}.`);
      return;
    }
    this.markFinishedVideoCompletedIfEnabled(endedPlayback);
    if (this.app.preferences.afterVideoEnds !== "PLAY_NEXT_VIDEO") {
      this.showStatusMessage(`Finished ${endedVideoTitle}.`);
      return;
    }
    const latestChannel = this.app.guideRepository.findChannel(endedPlayback.channelId);
    const nextVideoAfterEndedPlayback = nextVideoInPlayedOrLatestOrder(endedPlayback, latestChannel);
    if (nextVideoAfterEndedPlayback !== null) {
      this.playNextVideo(nextVideoAfterEndedPlayback.channel, nextVideoAfterEndedPlayback.video);
    } else {
      this.showStatusMessage(`That was the last video loaded for ${endedPlayback.channelName ?? "this channel"}.`);
    }
  }

  // TODO: Validate
  /**
   * Plays the video after or before the one the viewer skipped from with the player page's controls. The video
   * that was skipped from is not marked completed, and the up next screen is not shown.
   */
  private playSkippedToVideo(
    skippedPlayback: ActivePlayback,
    playbackOutcome: "skippedToNext" | "skippedToPrevious",
  ): void {
    const latestChannel = this.app.guideRepository.findChannel(skippedPlayback.channelId);
    const skippedToVideo =
      playbackOutcome === "skippedToNext"
        ? nextVideoInPlayedOrLatestOrder(skippedPlayback, latestChannel)
        : previousVideoInPlayedOrLatestOrder(skippedPlayback, latestChannel);
    const skippedChannelName = skippedPlayback.channelName ?? "this channel";
    if (skippedToVideo === null) {
      this.showStatusMessage(
        playbackOutcome === "skippedToNext"
          ? `That was the last video loaded for ${skippedChannelName}.`
          : `That was the first video on ${skippedChannelName}.`,
      );
      return;
    }
    this.guideGridView.focusEpisode(skippedToVideo.channel.id, skippedToVideo.video.episodeId);
    this.playVideo(skippedToVideo.channel, skippedToVideo.video);
  }

  // TODO: Validate
  private playNextVideo(channel: GuideChannel, nextVideo: GuideVideo): void {
    this.guideGridView.focusEpisode(channel.id, nextVideo.episodeId);
    if (!this.app.preferences.showsUpNextInformation) {
      this.playVideo(channel, nextVideo);
      return;
    }
    const followingVideo = nextPlayableVideo(channel, nextVideo.episodeId);
    new UpNextView(
      this.app.remoteInput,
      this.app.imageLoader,
      channel.name,
      nextVideo,
      followingVideo,
      (playsNextVideo) => {
        if (playsNextVideo) {
          this.playVideo(channel, nextVideo);
        } else {
          this.showStatusMessage(`Didn't play ${nextVideo.title ?? "the next video"}.`);
        }
        this.guideGridView.requestFocus();
      },
    ).show();
  }

  // TODO: Validate
  private testUpNextBumper(channel: GuideChannel, video: GuideVideo): void {
    const followingVideo = nextPlayableVideo(channel, video.episodeId);
    new UpNextView(this.app.remoteInput, this.app.imageLoader, channel.name, video, followingVideo, () =>
      this.guideGridView.requestFocus(),
    ).show();
  }
}

// TODO: Validate
function automaticOrManualLabel(isAutomatic: boolean): string {
  return isAutomatic ? "Automatic" : "Manual";
}

// TODO: Validate
function channelSettingLabel(channelSetting: boolean | null, accountSetting: boolean): string {
  return channelSetting === null
    ? `My setting (${automaticOrManualLabel(accountSetting)})`
    : automaticOrManualLabel(channelSetting);
}

// TODO: Validate
function nextChannelSetting(channelSetting: boolean | null): boolean | null {
  if (channelSetting === null) return true;
  return channelSetting ? false : null;
}

// TODO: Validate
import { LocalAppStorage } from "../data/local-app-storage";
import { lastEndedMediaSignal, listenForMediaEnded } from "../mediasessions/media-ended-signals";
import { findEveryVideo, findMainVideo, observeVideo } from "../mediasessions/video-observation";
import { AdSilencer } from "../playback/ads/ad-silencer";
import { AdWatcher } from "../playback/ads/ad-watcher";
import { type EpisodeState, PlaybackEndDetector } from "../playback/playback-end-detector";
import { formatPlayerTime, playbackEndRulesFor } from "../playback/playback-monitor";
import { SkipButtonClicker } from "../playback/skip-button-clicker";
import type { PlayerButtonField, StreamingSite } from "../streamingsites/streaming-site";
import {
  ALWAYS_ON_PLAY_NEXT_EPISODE_MOMENT,
  PLAY_NEXT_EPISODE_MOMENTS_IN_ORDER,
  PLAYER_BUTTON_FIELDS_IN_ORDER,
  PLAYER_BUTTON_KINDS,
  type PlayNextEpisodeWhen,
  playNextEpisodeWhenChoices,
  playNextEpisodeWhenLabel,
  STREAMING_SITE_TOGGLE_SETTINGS,
} from "../streamingsites/streaming-site-settings";
import { type PlayerPageControl, type PlayerPageDetail, PlayerPageOverlay } from "./player-page-overlay";
import { WindowFiller } from "./window-filler";

interface UnmonitoredEndCheck {
  unmonitoredEndDetector: PlaybackEndDetector;
  /** The checked moments the end detector was built from, joined into one string so a change can be spotted. */
  endDetectorCheckedMomentsKey: string;
  playbackEndRuleNames: string[];
  latestEpisodeState: EpisodeState | null;
  lastEndDetectedAt: number | null;
}

interface UnmonitoredPageActions {
  clickablePlayerButtonFieldToClicker: Map<PlayerButtonField, SkipButtonClicker>;
  latestSkipButtonClick: string | null;
  adSilencer: AdSilencer;
  isAdShowing: boolean;
  isSilencingAd: boolean;
}

// TODO: Validate
/**
 * Shows the debug overlay on a streaming page that Stream Channeler is not watching, such as one opened from a link,
 * while the userscript menu's always-show switch is on. It lists what the site's finders see on the page, so the
 * finders can be checked without launching a video from the guide.
 */
export async function startUnmonitoredDebugOverlay(pageSite: StreamingSite): Promise<void> {
  const preferences = await LocalAppStorage.load();
  const unmonitoredEndCheck: UnmonitoredEndCheck = {
    ...unmonitoredEndDetectorFor(preferences, pageSite),
    latestEpisodeState: null,
    lastEndDetectedAt: null,
  };
  const unmonitoredPageActions: UnmonitoredPageActions = {
    clickablePlayerButtonFieldToClicker: new Map(
      PLAYER_BUTTON_FIELDS_IN_ORDER.flatMap((playerButtonField) => {
        const pagePlayerButton = pageSite[playerButtonField];
        if (pagePlayerButton === undefined || !PLAYER_BUTTON_KINDS[playerButtonField].canBeClicked) return [];
        return [[playerButtonField, new SkipButtonClicker(pagePlayerButton.find)] as const];
      }),
    ),
    latestSkipButtonClick: null,
    adSilencer: new AdSilencer(),
    isAdShowing: false,
    isSilencingAd: false,
  };
  const unmonitoredWindowFiller =
    pageSite.fillWindowStyle === undefined ? null : new WindowFiller(pageSite.fillWindowStyle);
  const debugOverlayControls: PlayerPageControl[] = [
    {
      label: () =>
        unmonitoredWindowFiller === null
          ? "Fill the window: Not supported"
          : `Fill the window: ${onOffLabel(preferences.unmonitoredOverlayFillsWindow)}`,
      onSelected: () => {
        if (unmonitoredWindowFiller === null) return;
        preferences.unmonitoredOverlayFillsWindow = !preferences.unmonitoredOverlayFillsWindow;
        syncWindowFill(preferences, unmonitoredWindowFiller);
      },
    },
    {
      label: () => `Alert when the end is detected: ${onOffLabel(preferences.unmonitoredOverlayAlertsOnEnd)}`,
      onSelected: () => {
        preferences.unmonitoredOverlayAlertsOnEnd = !preferences.unmonitoredOverlayAlertsOnEnd;
      },
    },
    ...websiteSettingControls(preferences, pageSite),
  ];
  // The overlay never opens on mouse moves here. It only follows the always-show switch, which the refresh reads.
  const unmonitoredDebugOverlay = new PlayerPageOverlay(
    debugOverlayControls,
    () => unmonitoredPageDetails(preferences, pageSite, unmonitoredEndCheck, unmonitoredPageActions),
    () => false,
    () => preferences.alwaysShowsPlayerPageOverlay,
  );
  unmonitoredDebugOverlay.start();
  if (pageSite.createAdMarker !== undefined) {
    new AdWatcher(
      pageSite.createAdMarker(),
      () => {
        const mainVideo = findMainVideo(document);
        const adWatchedPlaybackStatus = mainVideo === null ? null : observeVideo(mainVideo).playbackStatus;
        return adWatchedPlaybackStatus === "PLAYING" || adWatchedPlaybackStatus === "BUFFERING";
      },
      (isAdShowing) => {
        unmonitoredPageActions.isAdShowing = isAdShowing;
      },
    ).start();
  }
  let latestMainVideo: HTMLVideoElement | null = null;
  setInterval(() => {
    if (unmonitoredWindowFiller !== null) {
      // A new video element means the site built a new player, and the new player needs to measure the filled window.
      const mainVideo = findMainVideo(document);
      if (mainVideo !== latestMainVideo && unmonitoredWindowFiller.isFilling) unmonitoredWindowFiller.relayOutPlayer();
      latestMainVideo = mainVideo;
      syncWindowFill(preferences, unmonitoredWindowFiller);
    }
    // The page only acts on the website settings while the debug overlay shows. Otherwise a page the viewer opened
    // themselves would click buttons and silence ads without the viewer asking for it.
    if (preferences.alwaysShowsPlayerPageOverlay)
      clickTurnedOnSkipButtons(preferences, pageSite, unmonitoredPageActions);
    silenceAdsWhenTurnedOn(preferences, pageSite, unmonitoredPageActions);
    checkForEnd(preferences, pageSite, unmonitoredEndCheck);
    unmonitoredDebugOverlay.refresh();
  }, 1_000);
}

// TODO: Validate
function unmonitoredEndDetectorFor(
  preferences: LocalAppStorage,
  pageSite: StreamingSite,
): Pick<UnmonitoredEndCheck, "unmonitoredEndDetector" | "endDetectorCheckedMomentsKey" | "playbackEndRuleNames"> {
  const checkedPlayNextEpisodeMoments = preferences.streamingSiteSettings(
    pageSite.pluginKey,
  ).checkedPlayNextEpisodeMoments;
  // The site's end rules run here the same way they run for a video from the guide, but they only report what they
  // detect. The page has no guide video, so the video length is not known.
  const playbackEndRules = playbackEndRulesFor(pageSite, checkedPlayNextEpisodeMoments);
  return {
    unmonitoredEndDetector: new PlaybackEndDetector(Date.now(), playbackEndRules),
    endDetectorCheckedMomentsKey: checkedPlayNextEpisodeMoments.join(","),
    playbackEndRuleNames: playbackEndRules.map((playbackEndRule) => playbackEndRule.constructor.name),
  };
}

// TODO: Validate
/**
 * Fills the window while the debug overlay shows and its fill switch is on, and restores the page otherwise. The switch
 * is saved, so a reload or another page of the same kind fills the window again.
 */
function syncWindowFill(preferences: LocalAppStorage, unmonitoredWindowFiller: WindowFiller): void {
  const shouldFillWindow = preferences.alwaysShowsPlayerPageOverlay && preferences.unmonitoredOverlayFillsWindow;
  if (shouldFillWindow && !unmonitoredWindowFiller.isFilling) unmonitoredWindowFiller.fill();
  if (!shouldFillWindow && unmonitoredWindowFiller.isFilling) unmonitoredWindowFiller.restore();
}

// TODO: Validate
function onOffLabel(isOn: boolean): string {
  return isOn ? "On" : "Off";
}

// TODO: Validate
/**
 * Returns a control for every website setting, such as clicking the Skip Intro button. A setting the site does not
 * support, or a moment that is always on, still gets a control so the overlay shows that it was considered.
 */
function websiteSettingControls(preferences: LocalAppStorage, pageSite: StreamingSite): PlayerPageControl[] {
  const toggleSettingControls = STREAMING_SITE_TOGGLE_SETTINGS.map(
    (toggleSetting): PlayerPageControl => ({
      label: () =>
        toggleSetting.isSupportedBy(pageSite)
          ? `${toggleSetting.label}: ${onOffLabel(toggleSetting.isOnIn(preferences.streamingSiteSettings(pageSite.pluginKey)))}`
          : `${toggleSetting.label}: Not supported`,
      onSelected: () => {
        if (!toggleSetting.isSupportedBy(pageSite)) return;
        const currentSiteSettings = preferences.streamingSiteSettings(pageSite.pluginKey);
        preferences.writeStreamingSiteSettings(
          [pageSite.pluginKey],
          toggleSetting.settingsChange(currentSiteSettings, !toggleSetting.isOnIn(currentSiteSettings)),
        );
      },
    }),
  );
  const pageSiteMoments = playNextEpisodeWhenChoices(pageSite);
  const playNextEpisodeMomentControls = PLAY_NEXT_EPISODE_MOMENTS_IN_ORDER.map(
    (playNextEpisodeMoment): PlayerPageControl => {
      const momentLabel = `End when ${playNextEpisodeWhenLabel(playNextEpisodeMoment).toLowerCase()}`;
      if (!pageSiteMoments.includes(playNextEpisodeMoment)) {
        return { label: `${momentLabel}: Not supported`, onSelected: () => {} };
      }
      if (playNextEpisodeMoment === ALWAYS_ON_PLAY_NEXT_EPISODE_MOMENT)
        return { label: `${momentLabel}: Always on`, onSelected: () => {} };
      return {
        label: () => `${momentLabel}: ${onOffLabel(isMomentChecked(preferences, pageSite, playNextEpisodeMoment))}`,
        onSelected: () => {
          const wasMomentChecked = isMomentChecked(preferences, pageSite, playNextEpisodeMoment);
          const otherCheckedMoments = preferences
            .streamingSiteSettings(pageSite.pluginKey)
            .checkedPlayNextEpisodeMoments.filter((checkedMoment) => checkedMoment !== playNextEpisodeMoment);
          preferences.writeStreamingSiteSettings([pageSite.pluginKey], {
            checkedPlayNextEpisodeMoments: wasMomentChecked
              ? otherCheckedMoments
              : [...otherCheckedMoments, playNextEpisodeMoment],
          });
        },
      };
    },
  );
  return [...toggleSettingControls, ...playNextEpisodeMomentControls];
}

// TODO: Validate
function isMomentChecked(
  preferences: LocalAppStorage,
  pageSite: StreamingSite,
  playNextEpisodeMoment: PlayNextEpisodeWhen,
): boolean {
  return preferences
    .streamingSiteSettings(pageSite.pluginKey)
    .checkedPlayNextEpisodeMoments.includes(playNextEpisodeMoment);
}

// TODO: Validate
function clickTurnedOnSkipButtons(
  preferences: LocalAppStorage,
  pageSite: StreamingSite,
  unmonitoredPageActions: UnmonitoredPageActions,
): void {
  const now = Date.now();
  for (const clickedPlayerButtonField of preferences.streamingSiteSettings(pageSite.pluginKey).clickedPlayerButtons) {
    const skipButtonClicker = unmonitoredPageActions.clickablePlayerButtonFieldToClicker.get(clickedPlayerButtonField);
    if (skipButtonClicker?.clickWhenShowing(now) !== true) continue;
    const clickedPlayerButtonLabel = PLAYER_BUTTON_KINDS[clickedPlayerButtonField].label;
    console.info(`Clicked the ${clickedPlayerButtonLabel} button on ${pageSite.pluginKey} from the debug overlay`);
    unmonitoredPageActions.latestSkipButtonClick = `${clickedPlayerButtonLabel} at ${new Date(now).toLocaleTimeString()}`;
  }
}

// TODO: Validate
function silenceAdsWhenTurnedOn(
  preferences: LocalAppStorage,
  pageSite: StreamingSite,
  unmonitoredPageActions: UnmonitoredPageActions,
): void {
  const shouldSilenceAd =
    unmonitoredPageActions.isAdShowing &&
    preferences.alwaysShowsPlayerPageOverlay &&
    preferences.streamingSiteSettings(pageSite.pluginKey).silencesAds;
  if (shouldSilenceAd) {
    unmonitoredPageActions.adSilencer.silence();
    unmonitoredPageActions.adSilencer.keepSilencingNewVideos();
  } else if (unmonitoredPageActions.isSilencingAd) {
    unmonitoredPageActions.adSilencer.restore();
  }
  unmonitoredPageActions.isSilencingAd = shouldSilenceAd;
}

// TODO: Validate
function checkForEnd(
  preferences: LocalAppStorage,
  pageSite: StreamingSite,
  unmonitoredEndCheck: UnmonitoredEndCheck,
): void {
  // A moment turned on or off from the overlay, or from another tab, changes the end rules, so the detector is rebuilt.
  const checkedMomentsKey = preferences
    .streamingSiteSettings(pageSite.pluginKey)
    .checkedPlayNextEpisodeMoments.join(",");
  if (checkedMomentsKey !== unmonitoredEndCheck.endDetectorCheckedMomentsKey) {
    Object.assign(unmonitoredEndCheck, unmonitoredEndDetectorFor(preferences, pageSite), { latestEpisodeState: null });
  }
  listenForMediaEnded(findEveryVideo(document));
  const now = Date.now();
  const mainVideo = findMainVideo(document);
  const episodeState = unmonitoredEndCheck.unmonitoredEndDetector.evaluate(
    now,
    mainVideo === null ? null : observeVideo(mainVideo),
    lastEndedMediaSignal(),
    window.location.href,
  );
  const isNewlyFinished = episodeState === "FINISHED" && unmonitoredEndCheck.latestEpisodeState !== "FINISHED";
  unmonitoredEndCheck.latestEpisodeState = episodeState;
  if (!isNewlyFinished) return;
  unmonitoredEndCheck.lastEndDetectedAt = now;
  // The alert stands in for playing the next video, so an end rule can be tested on a page opened by hand.
  if (preferences.alwaysShowsPlayerPageOverlay && preferences.unmonitoredOverlayAlertsOnEnd) {
    window.alert(
      `Stream Channeler detected the end of the video (${unmonitoredEndCheck.playbackEndRuleNames.join(", ")})`,
    );
  }
}

// TODO: Validate
function unmonitoredPageDetails(
  preferences: LocalAppStorage,
  pageSite: StreamingSite,
  unmonitoredEndCheck: UnmonitoredEndCheck,
  unmonitoredPageActions: UnmonitoredPageActions,
): PlayerPageDetail[] {
  const mainVideo = findMainVideo(document);
  const mainVideoObservation = mainVideo === null ? null : observeVideo(mainVideo);
  const autoplayCheck = preferences.autoplayCheck(pageSite.pluginKey);
  return [
    { label: "Website", value: pageSite.pluginKey },
    { label: "Watching a video", value: "No, this tab was not opened from the guide" },
    { label: "Video", value: mainVideoObservation?.playbackStatus ?? "None found" },
    {
      label: "Position",
      value:
        mainVideoObservation === null
          ? "None"
          : `${formatPlayerTime(mainVideoObservation.position)} of ${
              mainVideoObservation.duration === null ? "unknown" : formatPlayerTime(mainVideoObservation.duration)
            }`,
    },
    { label: "Media title", value: mainVideoObservation?.mediaTitle ?? "None" },
    {
      label: "End detected",
      value:
        unmonitoredEndCheck.lastEndDetectedAt === null
          ? "No"
          : `Yes, at ${new Date(unmonitoredEndCheck.lastEndDetectedAt).toLocaleTimeString()}`,
    },
    { label: "End check", value: unmonitoredEndCheck.latestEpisodeState ?? "Not checked yet" },
    { label: "End rules", value: unmonitoredEndCheck.playbackEndRuleNames.join(", ") || "None" },
    { label: "Last skip click", value: unmonitoredPageActions.latestSkipButtonClick ?? "None" },
    {
      label: "Ad showing",
      value: pageSite.createAdMarker === undefined ? "Not watched" : unmonitoredPageActions.isAdShowing ? "Yes" : "No",
    },
    ...PLAYER_BUTTON_FIELDS_IN_ORDER.flatMap((playerButtonField) => {
      const pagePlayerButton = pageSite[playerButtonField];
      const playerButtonDetail = {
        label: `${PLAYER_BUTTON_KINDS[playerButtonField].label} button`,
        value: finderResultLabel(pagePlayerButton?.find),
      };
      if (pagePlayerButton?.findDismissButton === undefined) return [playerButtonDetail];
      return [
        playerButtonDetail,
        {
          label: `${PLAYER_BUTTON_KINDS[playerButtonField].label} dismiss button`,
          value: finderResultLabel(pagePlayerButton.findDismissButton),
        },
      ];
    }),
    { label: "Profile screen", value: profileScreenLabel(pageSite) },
    {
      label: "PIN screen",
      value:
        pageSite.pinEntry === undefined ? "Not supported" : pageSite.pinEntry() === null ? "Not showing" : "Showing",
    },
    { label: "Autoplay", value: autoplayCheck?.autoplayPermission ?? "Not checked" },
  ];
}

// TODO: Validate
function finderResultLabel(findElement: (() => HTMLElement | null) | undefined): string {
  if (findElement === undefined) return "Not supported";
  return findElement() ? "Showing" : "Not showing";
}

// TODO: Validate
function profileScreenLabel(pageSite: StreamingSite): string {
  const findProfileButtons = pageSite.profileButtons;
  if (findProfileButtons === undefined) return "Not supported";
  // A site's profile finder throws when the profile screen no longer matches it, and the overlay shows why.
  try {
    return `${findProfileButtons().length} profiles found`;
  } catch (profileScreenError) {
    return profileScreenError instanceof Error ? profileScreenError.message : String(profileScreenError);
  }
}

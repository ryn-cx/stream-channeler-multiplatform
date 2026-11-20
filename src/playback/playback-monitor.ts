// TODO: Validate

import type { LocalAppStorage, StoredValueKey } from "../data/local-app-storage";
import type { GuideVideo } from "../data/models";
import {
  askChildFramesToClickPlayButton,
  askChildFramesToObserveVideo,
  askChildFramesToPauseVideo,
  isVideoObservationFromFrame,
} from "../mediasessions/frame-messages";
import { lastEndedMediaSignal, listenForMediaEnded } from "../mediasessions/media-ended-signals";
import { findEveryVideo, findMainVideo, observeVideo, pauseEveryVideo } from "../mediasessions/video-observation";
import { type ProfilePickerSetup, recordProfilePickerProgress } from "../profiles/profile-picker";
import { WebProfilePicker } from "../profiles/web-profile-picker";
import {
  type PlayerPageControl,
  type PlayerPageDetail,
  PlayerPageOverlay,
} from "../screenautomation/player-page-overlay";
import { isBackKey } from "../screenautomation/remote-buttons";
import { StatusMessageOverlay } from "../screenautomation/status-message-overlay";
import { WindowFiller } from "../screenautomation/window-filler";
import type { PlayerButtonField, StreamingSite } from "../streamingsites/streaming-site";
import {
  activePlayNextEpisodeMoments,
  PLAYER_BUTTON_FIELDS_IN_ORDER,
  PLAYER_BUTTON_KINDS,
  type PlayNextEpisodeWhen,
} from "../streamingsites/streaming-site-settings";
import { AdSilencer } from "./ads/ad-silencer";
import { AdWatcher } from "./ads/ad-watcher";
import { OnScreenElementEndsVideo } from "./endrules/on-screen-element-ends-video";
import type { PlaybackEndRule } from "./endrules/playback-end-rule";
import { NextEpisodeCountdown } from "./next-episode-countdown";
import {
  type EndedMedia,
  type EpisodeState,
  type MediaObservation,
  PlaybackEndDetector,
} from "./playback-end-detector";
import { SkipButtonClicker } from "./skip-button-clicker";
import { returnToGuide, stopMonitoring } from "./video-player";

const FRAME_OBSERVATION_MAX_AGE = 2_500;

export interface ActivePlayback {
  channelId: string;
  channelName: string | null;
  channelVideos: GuideVideo[];
  playingEpisodeId: string;
  streamingSitePluginKey: string | null;
  launchedAt: number;
  isMonitoring: boolean;
}

/**
 * How the viewer left the video. "skippedToNext" and "skippedToPrevious" come from the player page's controls, and
 * the guide plays the next or the previous video for them.
 */
export type PlaybackOutcome = "finished" | "leftEarly" | "skippedToNext" | "skippedToPrevious";

export interface PendingPlaybackOutcome {
  playbackOutcome: PlaybackOutcome;
  returnedAt: number;
}

// TODO: Validate
export function playingVideoOf(activePlayback: ActivePlayback): GuideVideo | null {
  return activePlayback.channelVideos.find((video) => video.episodeId === activePlayback.playingEpisodeId) ?? null;
}

interface FrameObservation {
  observation: MediaObservation | null;
  lastEndedMedia: EndedMedia | null;
  receivedAt: number;
}

// TODO: Validate
export class PlaybackMonitor {
  private readonly preferences: LocalAppStorage;
  private readonly monitoredPlayback: ActivePlayback;
  private readonly pageSite: StreamingSite;
  private readonly endDetector: PlaybackEndDetector;
  private readonly statusMessageOverlay = new StatusMessageOverlay();
  private readonly nextEpisodeCountdown: NextEpisodeCountdown;
  private readonly webProfilePicker: WebProfilePicker | null;
  private readonly adWatcher: AdWatcher | null;
  private readonly adSilencer = new AdSilencer();
  private readonly clickablePlayerButtonFieldToClicker = new Map<PlayerButtonField, SkipButtonClicker>();
  private readonly playerButtonFieldToCountdownDismissClicker = new Map<PlayerButtonField, SkipButtonClicker>();
  private readonly playButtonClicker: SkipButtonClicker | null;
  private readonly windowFiller: WindowFiller | null;
  private readonly playerPageOverlay: PlayerPageOverlay;
  private readonly playbackEndRuleNames: string[];
  private latestEpisodeState: EpisodeState | null = null;
  private latestSkipButtonClick: string | null = null;
  private isAdShowing = false;
  private latestMainVideo: HTMLVideoElement | null = null;
  private readonly frameSourceToLatestObservation = new Map<MessageEventSource, FrameObservation>();
  private latestTopFrameObservation: MediaObservation | null = null;
  private wasVideoPlaying = false;
  private isCountingDownToNextVideo = false;
  private isStopped = false;
  private hasProfilePickerDisarmed = false;
  private readonly profilePickerArmedUntil: number;
  /** Whether the Back press that cancelled the countdown is still held, so its repeats and release are swallowed. */
  private swallowsBackKeyUntilReleased = false;
  private mediaTickIntervalId: ReturnType<typeof setInterval> | null = null;
  private startTimeoutId: ReturnType<typeof setTimeout> | null = null;
  // TODO: Validate
  private readonly onBackKeyDown = (keyboardEvent: KeyboardEvent) => this.handleBackKeyDown(keyboardEvent);
  // TODO: Validate
  private readonly onBackKeyUp = (keyboardEvent: KeyboardEvent) => this.handleBackKeyUp(keyboardEvent);
  // TODO: Validate
  private readonly onFrameMessage = (messageEvent: MessageEvent) => this.handleFrameMessage(messageEvent);
  // TODO: Validate
  private readonly onStoredValuesChanged = (changedKeys: StoredValueKey[]) => {
    if (!changedKeys.includes("activePlayback")) return;
    const savedActivePlayback = this.preferences.activePlayback;
    const isStillMonitoringThisPlayback =
      savedActivePlayback?.isMonitoring === true &&
      savedActivePlayback.launchedAt === this.monitoredPlayback.launchedAt;
    if (!isStillMonitoringThisPlayback) this.stopPlayerPage();
  };

  // TODO: Validate
  constructor(
    preferences: LocalAppStorage,
    monitoredPlayback: ActivePlayback,
    pageSite: StreamingSite,
    profilePickerSetup: ProfilePickerSetup | null,
  ) {
    this.preferences = preferences;
    this.monitoredPlayback = monitoredPlayback;
    this.pageSite = pageSite;
    const checkedPlayNextEpisodeMoments = preferences.streamingSiteSettings(
      pageSite.pluginKey,
    ).checkedPlayNextEpisodeMoments;
    const playbackEndRules = playbackEndRulesFor(pageSite, checkedPlayNextEpisodeMoments);
    this.playbackEndRuleNames = playbackEndRules.map((playbackEndRule) => playbackEndRule.constructor.name);
    this.endDetector = new PlaybackEndDetector(monitoredPlayback.launchedAt, playbackEndRules);
    this.windowFiller = pageSite.fillWindowStyle === undefined ? null : new WindowFiller(pageSite.fillWindowStyle);
    const windowFiller = this.windowFiller;
    const fillWindowControls: PlayerPageControl[] =
      windowFiller === null
        ? []
        : [
            {
              label: () => `Fill the window: ${windowFiller.isFilling ? "On" : "Off"}`,
              onSelected: () => (windowFiller.isFilling ? windowFiller.restore() : windowFiller.fill()),
            },
          ];
    this.playerPageOverlay = new PlayerPageOverlay(
      [
        { label: "Return to guide", onSelected: () => void this.pauseAndReturnToGuide("leftEarly") },
        { label: "Previous video", onSelected: () => void this.pauseAndReturnToGuide("skippedToPrevious") },
        { label: "Next video", onSelected: () => void this.pauseAndReturnToGuide("skippedToNext") },
        { label: "Finish video now", onSelected: () => this.finishVideoFromOverlay() },
        { label: "Stop automatic playback", onSelected: () => this.stopAutomaticPlaybackFromOverlay() },
        ...fillWindowControls,
      ],
      () => this.playerPageDetails(),
      () => this.preferences.showsPlayerPageOverlay,
      () => this.preferences.alwaysShowsPlayerPageOverlay,
    );
    this.profilePickerArmedUntil = profilePickerSetup?.armedUntil ?? 0;
    // The choice is made once, together with the end rules, so the two always agree for the video that is playing.
    const activeMoments = activePlayNextEpisodeMoments(pageSite, checkedPlayNextEpisodeMoments);
    for (const playerButtonField of PLAYER_BUTTON_FIELDS_IN_ORDER) {
      const pagePlayerButton = pageSite[playerButtonField];
      if (pagePlayerButton === undefined) continue;
      if (PLAYER_BUTTON_KINDS[playerButtonField].canBeClicked) {
        this.clickablePlayerButtonFieldToClicker.set(playerButtonField, new SkipButtonClicker(pagePlayerButton.find));
      }
      if (pagePlayerButton.findDismissButton && !activeMoments.includes(playerButtonField)) {
        this.playerButtonFieldToCountdownDismissClicker.set(
          playerButtonField,
          new SkipButtonClicker(pagePlayerButton.findDismissButton),
        );
      }
    }
    this.playButtonClicker =
      pageSite.findPlayButton === undefined ? null : new SkipButtonClicker(pageSite.findPlayButton);
    this.nextEpisodeCountdown = new NextEpisodeCountdown(this.statusMessageOverlay);
    this.webProfilePicker =
      profilePickerSetup === null
        ? null
        : new WebProfilePicker(
            pageSite,
            profilePickerSetup,
            pageSite.pluginKey,
            this.statusMessageOverlay,
            (profilePickerProgress) => {
              if (profilePickerProgress === "disarmed") this.hasProfilePickerDisarmed = true;
              void recordProfilePickerProgress(profilePickerProgress);
            },
          );
    const watchesForAds =
      preferences.streamingSiteSettings(pageSite.pluginKey).silencesAds && pageSite.createAdMarker !== undefined;
    this.adWatcher =
      !watchesForAds || pageSite.createAdMarker === undefined
        ? null
        : new AdWatcher(
            pageSite.createAdMarker(),
            () => {
              const adWatchedPlaybackStatus = this.latestTopFrameObservation?.playbackStatus;
              return adWatchedPlaybackStatus === "PLAYING" || adWatchedPlaybackStatus === "BUFFERING";
            },
            (isAdShowing) => this.onAdStateChanged(isAdShowing),
          );
  }

  // TODO: Validate
  start(): void {
    window.addEventListener("keydown", this.onBackKeyDown, true);
    window.addEventListener("keyup", this.onBackKeyUp, true);
    window.addEventListener("message", this.onFrameMessage);
    // The browser has no notification to stop watching from, so the userscript manager's menu offers it instead.
    GM_registerMenuCommand("Stop watching this video", () => {
      if (this.isStopped) return;
      console.info("The viewer stopped watching from the userscript menu");
      void this.stopMonitoringAndPlayerPage();
    });
    this.preferences.addChangeListener(this.onStoredValuesChanged);
    this.mediaTickIntervalId = setInterval(() => this.onMediaTick(), 1_000);
    this.startTimeoutId = setTimeout(
      () => this.onStartTimeout(),
      Math.max(0, this.monitoredPlayback.launchedAt + (3 * 60_000 + 1_000) - Date.now()),
    );
    this.webProfilePicker?.start();
    this.adWatcher?.start();
    this.windowFiller?.fill();
    this.playerPageOverlay.start();
  }

  // TODO: Validate
  private onMediaTick(): void {
    listenForMediaEnded(findEveryVideo(document));
    const mainVideo = findMainVideo(document);
    // A new video element means the site built a new player, and the new player needs to measure the filled window.
    if (mainVideo !== this.latestMainVideo) this.windowFiller?.relayOutPlayer();
    this.latestMainVideo = mainVideo;
    this.latestTopFrameObservation = mainVideo === null ? null : observeVideo(mainVideo);
    const isVideoPlaying = this.latestTopFrameObservation?.playbackStatus === "PLAYING";
    if (isVideoPlaying && !this.wasVideoPlaying) this.webProfilePicker?.onVideoStartedPlaying();
    this.wasVideoPlaying = isVideoPlaying;
    this.adSilencer.keepSilencingNewVideos();
    const now = Date.now();
    this.frameSourceToLatestObservation.set(window, {
      observation: this.latestTopFrameObservation,
      lastEndedMedia: lastEndedMediaSignal(),
      receivedAt: now,
    });
    askChildFramesToObserveVideo();
    this.playerPageOverlay.refresh();
    if (this.isCountingDownToNextVideo) return;
    // The setting is read on every tick, so turning it on or off applies to the video that is already playing.
    const pageSiteSettings = this.preferences.streamingSiteSettings(this.pageSite.pluginKey);
    for (const clickedPlayerButtonField of pageSiteSettings.clickedPlayerButtons) {
      if (this.clickablePlayerButtonFieldToClicker.get(clickedPlayerButtonField)?.clickWhenShowing(now) !== true) {
        continue;
      }
      const clickedPlayerButtonLabel = PLAYER_BUTTON_KINDS[clickedPlayerButtonField].label;
      console.info(`Clicked the ${clickedPlayerButtonLabel} button on ${this.pageSite.pluginKey}`);
      this.latestSkipButtonClick = `${clickedPlayerButtonLabel} at ${new Date(now).toLocaleTimeString()}`;
    }
    for (const [playerButtonField, countdownDismissClicker] of this.playerButtonFieldToCountdownDismissClicker) {
      if (!countdownDismissClicker.clickWhenShowing(now)) continue;
      const dismissedPlayerButtonLabel = PLAYER_BUTTON_KINDS[playerButtonField].label;
      console.info(`Dismissed the ${dismissedPlayerButtonLabel} countdown on ${this.pageSite.pluginKey}`);
      this.latestSkipButtonClick = `${dismissedPlayerButtonLabel} dismissed at ${new Date(now).toLocaleTimeString()}`;
    }
    // The video can play in a child frame, as on PBS, so every frame's latest observation is checked.
    const isWaitingForPlaybackToStart =
      !this.endDetector.hasStartedPlaying && this.bestRecentObservation(now)?.playbackStatus !== "PLAYING";
    if (isWaitingForPlaybackToStart && this.playButtonClicker !== null) {
      if (this.playButtonClicker.clickWhenShowing(now)) {
        console.info(`Clicked the Play button on ${this.pageSite.pluginKey}`);
        this.latestSkipButtonClick = `Play at ${new Date(now).toLocaleTimeString()}`;
      }
      askChildFramesToClickPlayButton();
    }
    // Playback that starts while the profile picker still waits can be cut off by the site's profile screen, which
    // would look like a stop. So the end detector only starts once the picker is done with the page.
    if (this.isProfilePickerStillArmed(now)) return;
    const episodeState = this.endDetector.evaluate(
      now,
      this.bestRecentObservation(now),
      this.latestEndedMediaInAnyFrame(),
      window.location.href,
    );
    this.latestEpisodeState = episodeState;
    if (episodeState === "FINISHED") {
      console.info(`Video finished on ${this.pageSite.pluginKey}`);
      this.finishVideoAfterCountdown();
    } else if (episodeState === "NEVER_STARTED") {
      console.info(`Playback never started on ${this.pageSite.pluginKey}`);
      void this.stopMonitoringAndPlayerPage();
    }
  }

  // TODO: Validate
  private handleFrameMessage(messageEvent: MessageEvent): void {
    if (messageEvent.source === null || messageEvent.source === window) return;
    if (!isVideoObservationFromFrame(messageEvent.data)) return;
    this.frameSourceToLatestObservation.set(messageEvent.source, {
      observation: messageEvent.data.observation,
      lastEndedMedia: messageEvent.data.lastEndedMedia ?? null,
      receivedAt: Date.now(),
    });
  }

  // TODO: Validate
  private latestEndedMediaInAnyFrame(): EndedMedia | null {
    let latestEndedMedia: EndedMedia | null = null;
    for (const frameObservation of this.frameSourceToLatestObservation.values()) {
      const frameEndedMedia = frameObservation.lastEndedMedia;
      if (frameEndedMedia === null) continue;
      if (latestEndedMedia === null || frameEndedMedia.endedAt > latestEndedMedia.endedAt) {
        latestEndedMedia = frameEndedMedia;
      }
    }
    return latestEndedMedia;
  }

  // TODO: Validate
  private bestRecentObservation(now: number): MediaObservation | null {
    const recentObservations = [...this.frameSourceToLatestObservation.values()]
      .filter((frameObservation) => now - frameObservation.receivedAt <= FRAME_OBSERVATION_MAX_AGE)
      .flatMap((frameObservation) => (frameObservation.observation === null ? [] : [frameObservation.observation]));
    return (
      recentObservations.find((recentObservation) => recentObservation.playbackStatus === "PLAYING") ??
      recentObservations[0] ??
      null
    );
  }

  // TODO: Validate
  private onStartTimeout(): void {
    this.startTimeoutId = null;
    if (this.isStopped || this.endDetector.hasStartedPlaying) return;
    if (this.endDetector.evaluate(Date.now(), null, null, window.location.href) === "NEVER_STARTED") {
      console.info("Playback never started");
      void this.stopMonitoringAndPlayerPage();
    }
  }

  // TODO: Validate
  private finishVideoAfterCountdown(): void {
    const nextEpisodeCountdownSeconds = this.preferences.nextEpisodeCountdownSeconds;
    if (this.preferences.afterVideoEnds !== "PLAY_NEXT_VIDEO" || nextEpisodeCountdownSeconds <= 0) {
      void this.pauseAndReturnToGuide("finished");
      return;
    }
    this.isCountingDownToNextVideo = true;
    this.nextEpisodeCountdown.start(
      nextEpisodeCountdownSeconds,
      () => void this.pauseAndReturnToGuide("finished"),
      () => {
        console.info("The viewer cancelled the next episode countdown");
        void this.stopMonitoringAndPlayerPage();
      },
    );
  }

  // TODO: Validate
  private async pauseAndReturnToGuide(playbackOutcome: PlaybackOutcome): Promise<void> {
    pauseEveryVideo(document);
    askChildFramesToPauseVideo();
    this.stopPlayerPage();
    await returnToGuide(this.preferences, playbackOutcome);
  }

  // TODO: Validate
  /** Ends the video as if its end had been detected, so the end of a video can be tried without watching it. */
  private finishVideoFromOverlay(): void {
    if (this.isStopped || this.isCountingDownToNextVideo) return;
    console.info(`The viewer finished the video on ${this.pageSite.pluginKey} from the overlay`);
    this.finishVideoAfterCountdown();
  }

  // TODO: Validate
  private stopAutomaticPlaybackFromOverlay(): void {
    if (this.isStopped) return;
    console.info("The viewer stopped automatic playback from the overlay");
    void this.stopMonitoringAndPlayerPage();
  }

  // TODO: Validate
  private playerPageDetails(): PlayerPageDetail[] {
    const pageSiteSettings = this.preferences.streamingSiteSettings(this.pageSite.pluginKey);
    const now = Date.now();
    const playingVideo = playingVideoOf(this.monitoredPlayback);
    const bestObservation = this.bestRecentObservation(now);
    const reportingFrameCount = [...this.frameSourceToLatestObservation.values()].filter(
      (frameObservation) => now - frameObservation.receivedAt <= FRAME_OBSERVATION_MAX_AGE,
    ).length;
    const latestEndedMedia = this.latestEndedMediaInAnyFrame();
    let profilePickerState = "Not used";
    if (this.webProfilePicker !== null) {
      profilePickerState = this.isProfilePickerStillArmed(now) ? "Waiting for the profile screen" : "Done";
    }
    let videoPosition = "None";
    if (bestObservation !== null) {
      const videoDuration = bestObservation.duration === null ? "unknown" : formatPlayerTime(bestObservation.duration);
      videoPosition = `${formatPlayerTime(bestObservation.position)} of ${videoDuration} at ${bestObservation.playbackSpeed}x`;
    }
    let adShowing = "Not watched";
    if (this.adWatcher !== null) adShowing = this.isAdShowing ? "Yes" : "No";
    let fillsWindow = "Not for this website";
    if (this.windowFiller !== null) fillsWindow = this.windowFiller.isFilling ? "Yes" : "No";
    return [
      { label: "Website", value: this.pageSite.pluginKey },
      { label: "Channel", value: this.monitoredPlayback.channelName ?? this.monitoredPlayback.channelId },
      { label: "Video", value: playingVideo?.title ?? "Unknown" },
      { label: "Episode", value: playingVideo?.subtitle || "None" },
      { label: "Episode ID", value: this.monitoredPlayback.playingEpisodeId },
      { label: "Video link", value: playingVideo?.url ?? "None" },
      { label: "Page address", value: window.location.href },
      { label: "Launched", value: `${formatPlayerTime(now - this.monitoredPlayback.launchedAt)} ago` },
      { label: "Video status", value: bestObservation?.playbackStatus ?? "No video found" },
      { label: "Video position", value: videoPosition },
      { label: "Media title", value: bestObservation?.mediaTitle ?? "None" },
      { label: "Media ID", value: bestObservation?.mediaId ?? "None" },
      { label: "Frames with a video", value: String(reportingFrameCount) },
      {
        label: "Last ended video",
        value: latestEndedMedia === null ? "None" : `${formatPlayerTime(now - latestEndedMedia.endedAt)} ago`,
      },
      { label: "Playback started", value: this.endDetector.hasStartedPlaying ? "Yes" : "No" },
      { label: "End check", value: this.latestEpisodeState ?? "Not checked yet" },
      { label: "End rules", value: this.playbackEndRuleNames.join(", ") || "None" },
      { label: "Counting down to next", value: this.isCountingDownToNextVideo ? "Yes" : "No" },
      { label: "After the video", value: this.preferences.afterVideoEnds },
      {
        label: "Play next episode when",
        value: activePlayNextEpisodeMoments(this.pageSite, pageSiteSettings.checkedPlayNextEpisodeMoments).join(", "),
      },
      { label: "Profile picker", value: profilePickerState },
      { label: "Ad showing", value: adShowing },
      {
        label: "Clicked buttons",
        value:
          pageSiteSettings.clickedPlayerButtons
            .map((clickedPlayerButtonField) => PLAYER_BUTTON_KINDS[clickedPlayerButtonField].label)
            .join(", ") || "None",
      },
      {
        label: "Dismissed countdowns",
        value:
          [...this.playerButtonFieldToCountdownDismissClicker.keys()]
            .map((dismissedPlayerButtonField) => PLAYER_BUTTON_KINDS[dismissedPlayerButtonField].label)
            .join(", ") || "None",
      },
      { label: "Last skip click", value: this.latestSkipButtonClick ?? "None" },
      { label: "Fills the window", value: fillsWindow },
    ];
  }

  // TODO: Validate
  private onAdStateChanged(isAdShowing: boolean): void {
    this.isAdShowing = isAdShowing;
    if (isAdShowing && this.preferences.streamingSiteSettings(this.pageSite.pluginKey).silencesAds) {
      this.adSilencer.silence();
    } else {
      this.adSilencer.restore();
    }
  }

  // TODO: Validate
  private isProfilePickerStillArmed(now: number): boolean {
    return this.webProfilePicker !== null && !this.hasProfilePickerDisarmed && now < this.profilePickerArmedUntil;
  }

  // TODO: Validate
  private handleBackKeyDown(keyboardEvent: KeyboardEvent): void {
    if (!isBackKey(keyboardEvent)) return;
    // A held Back press that already cancelled the countdown keeps repeating. The site must not see those repeats.
    const isRepeatOfCancellingBackPress = keyboardEvent.repeat && this.swallowsBackKeyUntilReleased;
    const didCancelCountdown = !isRepeatOfCancellingBackPress && this.nextEpisodeCountdown.cancelOnBackPress();
    if (didCancelCountdown) this.swallowsBackKeyUntilReleased = true;
    const didHandleBackKey =
      isRepeatOfCancellingBackPress || didCancelCountdown || (this.webProfilePicker?.cancelOnBackPress() ?? false);
    if (!didHandleBackKey) return;
    keyboardEvent.preventDefault();
    keyboardEvent.stopImmediatePropagation();
  }

  // TODO: Validate
  private handleBackKeyUp(keyboardEvent: KeyboardEvent): void {
    if (!isBackKey(keyboardEvent) || !this.swallowsBackKeyUntilReleased) return;
    this.swallowsBackKeyUntilReleased = false;
    keyboardEvent.preventDefault();
    keyboardEvent.stopImmediatePropagation();
  }

  // TODO: Validate
  private async stopMonitoringAndPlayerPage(): Promise<void> {
    this.stopPlayerPage();
    await stopMonitoring(this.preferences);
  }

  // TODO: Validate
  private stopPlayerPage(): void {
    if (this.isStopped) return;
    this.isStopped = true;
    if (this.mediaTickIntervalId !== null) clearInterval(this.mediaTickIntervalId);
    this.mediaTickIntervalId = null;
    if (this.startTimeoutId !== null) clearTimeout(this.startTimeoutId);
    this.startTimeoutId = null;
    this.nextEpisodeCountdown.cancelSilently();
    this.adWatcher?.stop();
    this.adSilencer.restore();
    window.removeEventListener("keydown", this.onBackKeyDown, true);
    window.removeEventListener("keyup", this.onBackKeyUp, true);
    window.removeEventListener("message", this.onFrameMessage);
    this.preferences.removeChangeListener(this.onStoredValuesChanged);
    this.windowFiller?.restore();
    this.playerPageOverlay.stop();
  }
}

// TODO: Validate
/** Formats a time in milliseconds as hours, minutes and seconds, such as 1:02:03 or 4:05. */
export function formatPlayerTime(time: number): string {
  const totalSeconds = Math.max(0, Math.floor(time / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

// TODO: Validate
/** Returns pageSite's end rules: one for each checked moment the site has, and one for its always-on moment. */
export function playbackEndRulesFor(
  pageSite: StreamingSite,
  checkedPlayNextEpisodeMoments: PlayNextEpisodeWhen[],
): PlaybackEndRule[] {
  return activePlayNextEpisodeMoments(pageSite, checkedPlayNextEpisodeMoments)
    .map((playNextEpisodeMoment) => playbackEndRuleForMoment(pageSite, playNextEpisodeMoment))
    .filter((playbackEndRule) => playbackEndRule !== null);
}

// TODO: Validate
function playbackEndRuleForMoment(
  pageSite: StreamingSite,
  playNextEpisodeMoment: PlayNextEpisodeWhen,
): PlaybackEndRule | null {
  if (playNextEpisodeMoment === "Episode ends") return pageSite.playbackEndDetection();
  const momentPlayerButton = pageSite[playNextEpisodeMoment];
  return momentPlayerButton === undefined ? null : new OnScreenElementEndsVideo(momentPlayerButton.find);
}

// TODO: Validate
import { LocalAppStorage } from "../data/local-app-storage";
import { startAnsweringTopFrame } from "../mediasessions/frame-messages";
import { recordAutoplayPermission } from "../playback/autoplay-check";
import { type ActivePlayback, PlaybackMonitor, playingVideoOf } from "../playback/playback-monitor";
import { stopMonitoring } from "../playback/video-player";
import { type ProfilePickerSetup, readProfilePickerArmedState } from "../profiles/profile-picker";
import { hasProfileScreen, type StreamingSite, streamingSiteForHost } from "../streamingsites/streaming-site";
import { readGmValue } from "../userscript/gm-values";
import { startUnmonitoredDebugOverlay } from "./unmonitored-debug-overlay";

const PLAYER_PAGE_LAUNCH_SESSION_KEY = "streamChannelerDvrLaunchedAt";

// TODO: Validate
export function startPlayerPage(): void {
  if (window.top !== window) {
    startAnsweringTopFrame();
    return;
  }
  const pageSite = streamingSiteForHost(window.location.hostname);
  if (pageSite === null) return;
  void recordAutoplayPermission(pageSite);
  void startTopFramePlayerPage(pageSite).then((isWatchingVideo) => {
    if (!isWatchingVideo) void startUnmonitoredDebugOverlay(pageSite);
  });
}

// TODO: Validate
/** Starts watching the video this tab was opened for. Returns whether this tab is watching a video. */
async function startTopFramePlayerPage(pageSite: StreamingSite): Promise<boolean> {
  const savedActivePlayback = (await readGmValue<ActivePlayback>("activePlayback")) ?? null;
  if (savedActivePlayback === null || !savedActivePlayback.isMonitoring) return false;
  if (!claimsThisTabAsPlayerPage(savedActivePlayback, pageSite)) return false;
  const preferences = await LocalAppStorage.load();
  const monitoredPlayback = preferences.activePlayback;
  if (monitoredPlayback === null || monitoredPlayback.launchedAt !== savedActivePlayback.launchedAt) return false;
  if (Date.now() - monitoredPlayback.launchedAt > 6 * 60 * 60_000) {
    await stopMonitoring(preferences);
    return false;
  }
  const profilePickerSetup = await profilePickerSetupFor(preferences, pageSite, monitoredPlayback);
  new PlaybackMonitor(preferences, monitoredPlayback, pageSite, profilePickerSetup).start();
  return true;
}

// TODO: Validate
function claimsThisTabAsPlayerPage(monitoredPlayback: ActivePlayback, pageSite: StreamingSite): boolean {
  const launchedAtText = String(monitoredPlayback.launchedAt);
  try {
    if (window.sessionStorage.getItem(PLAYER_PAGE_LAUNCH_SESSION_KEY) === launchedAtText) return true;
  } catch {
    return false;
  }
  const isFreshLaunchOnThisSite =
    monitoredPlayback.streamingSitePluginKey === pageSite.pluginKey &&
    Date.now() - monitoredPlayback.launchedAt <= 60_000;
  if (!isFreshLaunchOnThisSite) return false;
  try {
    window.sessionStorage.setItem(PLAYER_PAGE_LAUNCH_SESSION_KEY, launchedAtText);
  } catch {
    return false;
  }
  return true;
}

// TODO: Validate
async function profilePickerSetupFor(
  preferences: LocalAppStorage,
  pageSite: StreamingSite,
  monitoredPlayback: ActivePlayback,
): Promise<ProfilePickerSetup | null> {
  if (!hasProfileScreen(pageSite)) return null;
  const profilePickerArmedState = await readProfilePickerArmedState();
  const isProfilePickerArmed =
    profilePickerArmedState !== null &&
    !profilePickerArmedState.isDisarmed &&
    Date.now() < profilePickerArmedState.armedUntil;
  if (!isProfilePickerArmed) return null;
  return {
    armedUntil: profilePickerArmedState.armedUntil,
    wantedProfileName: preferences.streamingProfileName(pageSite.pluginKey).trim(),
    profilePin: pageSite.pinEntry !== undefined ? preferences.streamingProfilePin(pageSite.pluginKey) : "",
    hasPickedProfile: profilePickerArmedState.hasPickedProfile,
    videoUrl: playingVideoOf(monitoredPlayback)?.url ?? null,
  };
}

// TODO: Validate
import type { AutoplayCheck } from "../playback/autoplay-check";
import type { ActivePlayback, PendingPlaybackOutcome } from "../playback/playback-monitor";
import { DEFAULT_STREAMING_SITE_SETTINGS, type StreamingSiteSettings } from "../streamingsites/streaming-site-settings";
import { listenForGmValueChange, readGmValue, writeGmValue } from "../userscript/gm-values";
import { isJsonObject, type JsonObject, optionalObject, optionalString } from "./json-fields";
import {
  type AccountRefreshSettings,
  type AfterVideoEnds,
  ALL_GUIDE_SCOPES,
  accountRefreshSettingsFromJson,
  type ChannelRefreshSettings,
  channelRefreshSettingsJson,
  followsAccountDefaults,
  type GuideScope,
  type OrderSeeds,
  type SignedInUser,
} from "./models";

export const DEFAULT_MINIMUM_VIDEO_MINUTES = 0;
export const DEFAULT_GUIDE_DETAILS_HEIGHT_PERCENT = 15;
export const DEFAULT_ZOOM_PERCENT = 100;

interface DeviceStreamingProfile {
  profileName: string;
  profilePin: string;
}

interface StoredValues {
  accessToken: string | null;
  signedInDisplayName: string | null;
  hasChosenAnonymous: boolean;
  afterVideoEnds: AfterVideoEnds;
  showsPlayerPageOverlay: boolean;
  alwaysShowsPlayerPageOverlay: boolean;
  unmonitoredOverlayFillsWindow: boolean;
  unmonitoredOverlayAlertsOnEnd: boolean;
  nextEpisodeCountdownSeconds: number;
  showsUpNextInformation: boolean;
  showsCondensedGuide: boolean;
  showsGuideSourceLogos: boolean;
  sizesGuideVideosByText: boolean;
  minimumVideoMinutes: number;
  guideDetailsHeightPercent: number;
  zoomPercent: number;
  guideScope: GuideScope;
  marksStartedVideosWatched: boolean;
  marksFinishedVideosCompleted: boolean;
  activePlayback: ActivePlayback | null;
  pendingPlaybackOutcome: PendingPlaybackOutcome | null;
  accountUserJson: JsonObject | null;
  localMinimumEpisodeOrderSeed: number;
  localChannelOrderSeed: number;
  localChannelIdToEpisodeSeed: Record<string, number>;
  watchedEpisodeIdToWatchedAt: Record<string, number>;
  settingsKeyToDeviceStreamingProfile: Record<string, DeviceStreamingProfile>;
  pluginKeyToStreamingSiteSettings: Record<string, Partial<StreamingSiteSettings>>;
  pluginKeyToAutoplayCheck: Record<string, AutoplayCheck>;
}

export type StoredValueKey = keyof StoredValues;

const DEFAULT_STORED_VALUES: StoredValues = {
  accessToken: null,
  signedInDisplayName: null,
  hasChosenAnonymous: false,
  afterVideoEnds: "PLAY_NEXT_VIDEO",
  showsPlayerPageOverlay: true,
  alwaysShowsPlayerPageOverlay: false,
  unmonitoredOverlayFillsWindow: false,
  unmonitoredOverlayAlertsOnEnd: true,
  nextEpisodeCountdownSeconds: 0,
  showsUpNextInformation: false,
  showsCondensedGuide: false,
  showsGuideSourceLogos: true,
  sizesGuideVideosByText: false,
  minimumVideoMinutes: DEFAULT_MINIMUM_VIDEO_MINUTES,
  guideDetailsHeightPercent: DEFAULT_GUIDE_DETAILS_HEIGHT_PERCENT,
  zoomPercent: DEFAULT_ZOOM_PERCENT,
  guideScope: "PUBLIC",
  marksStartedVideosWatched: true,
  marksFinishedVideosCompleted: true,
  activePlayback: null,
  pendingPlaybackOutcome: null,
  accountUserJson: null,
  localMinimumEpisodeOrderSeed: 0,
  localChannelOrderSeed: 0,
  localChannelIdToEpisodeSeed: {},
  watchedEpisodeIdToWatchedAt: {},
  settingsKeyToDeviceStreamingProfile: {},
  pluginKeyToStreamingSiteSettings: {},
  pluginKeyToAutoplayCheck: {},
};

const STORED_VALUE_KEYS = Object.keys(DEFAULT_STORED_VALUES) as StoredValueKey[];

// Stored values that must be one of a fixed set of names. A saved name that is no longer in the set falls back to the
// default, like the Android app's enumPreference.
const STORED_VALUE_KEY_TO_ALLOWED_NAMES: Partial<Record<StoredValueKey, readonly string[]>> = {
  afterVideoEnds: ["PLAY_NEXT_VIDEO", "RETURN_TO_GUIDE"],
  guideScope: ALL_GUIDE_SCOPES,
};

// TODO: Validate
function storedValueOrDefault(storedValueKey: StoredValueKey, savedValue: unknown): unknown {
  if (savedValue === undefined || savedValue === null) return DEFAULT_STORED_VALUES[storedValueKey];
  const allowedNames = STORED_VALUE_KEY_TO_ALLOWED_NAMES[storedValueKey];
  if (allowedNames !== undefined && (typeof savedValue !== "string" || !allowedNames.includes(savedValue))) {
    return DEFAULT_STORED_VALUES[storedValueKey];
  }
  return savedValue;
}

// TODO: Validate
export class LocalAppStorage {
  private readonly storedValues: StoredValues;
  private readonly changeListeners = new Set<(changedKeys: StoredValueKey[]) => void>();
  private readonly pendingWrites = new Set<Promise<void>>();

  // TODO: Validate
  private constructor(storedValues: StoredValues) {
    this.storedValues = storedValues;
    for (const storedValueKey of STORED_VALUE_KEYS) {
      listenForGmValueChange(storedValueKey, (changedValue) => {
        Object.assign(this.storedValues, {
          [storedValueKey]: storedValueOrDefault(storedValueKey, changedValue),
        });
        for (const changeListener of [...this.changeListeners]) changeListener([storedValueKey]);
      });
    }
  }

  // TODO: Validate
  static async load(): Promise<LocalAppStorage> {
    const savedValueEntries = await Promise.all(
      STORED_VALUE_KEYS.map(async (storedValueKey) => [storedValueKey, await readGmValue(storedValueKey)] as const),
    );
    const savedValues = Object.fromEntries(
      savedValueEntries.map(([storedValueKey, savedValue]) => [
        storedValueKey,
        storedValueOrDefault(storedValueKey, savedValue),
      ]),
    );
    return new LocalAppStorage({ ...DEFAULT_STORED_VALUES, ...savedValues } as StoredValues);
  }

  // TODO: Validate
  addChangeListener(changeListener: (changedKeys: StoredValueKey[]) => void): void {
    this.changeListeners.add(changeListener);
  }

  // TODO: Validate
  removeChangeListener(changeListener: (changedKeys: StoredValueKey[]) => void): void {
    this.changeListeners.delete(changeListener);
  }

  // TODO: Validate
  private write(changedValues: Partial<StoredValues>): Promise<void> {
    Object.assign(this.storedValues, changedValues);
    const pendingWrite = Promise.all(
      Object.entries(changedValues).map(([changedKey, changedValue]) =>
        writeGmValue(changedKey, changedValue as Tampermonkey.StorageValue),
      ),
    ).then(() => undefined);
    this.pendingWrites.add(pendingWrite);
    void pendingWrite.finally(() => this.pendingWrites.delete(pendingWrite)).catch(() => undefined);
    return pendingWrite;
  }

  // TODO: Validate
  async finishPendingWrites(): Promise<void> {
    await Promise.allSettled([...this.pendingWrites]);
  }

  // TODO: Validate
  get accessToken(): string | null {
    return this.storedValues.accessToken;
  }

  // TODO: Validate
  set accessToken(accessToken: string | null) {
    void this.write({ accessToken });
  }

  // TODO: Validate
  get signedInDisplayName(): string | null {
    return this.storedValues.signedInDisplayName;
  }

  // TODO: Validate
  set signedInDisplayName(signedInDisplayName: string | null) {
    void this.write({ signedInDisplayName });
  }

  // TODO: Validate
  get hasChosenAnonymous(): boolean {
    return this.storedValues.hasChosenAnonymous;
  }

  // TODO: Validate
  set hasChosenAnonymous(hasChosenAnonymous: boolean) {
    void this.write({ hasChosenAnonymous });
  }

  // TODO: Validate
  get isSignedIn(): boolean {
    return (this.storedValues.accessToken ?? "").length > 0;
  }

  // TODO: Validate
  get hasFinishedLogin(): boolean {
    return this.isSignedIn || this.hasChosenAnonymous;
  }

  // TODO: Validate
  get afterVideoEnds(): AfterVideoEnds {
    return this.storedValues.afterVideoEnds;
  }

  // TODO: Validate
  set afterVideoEnds(afterVideoEnds: AfterVideoEnds) {
    void this.write({ afterVideoEnds });
  }

  // TODO: Validate
  get showsPlayerPageOverlay(): boolean {
    return this.storedValues.showsPlayerPageOverlay;
  }

  // TODO: Validate
  set showsPlayerPageOverlay(showsPlayerPageOverlay: boolean) {
    void this.write({ showsPlayerPageOverlay });
  }

  // TODO: Validate
  /** Whether the player page's debug overlay stays on screen. It is switched from the userscript manager's menu. */
  get alwaysShowsPlayerPageOverlay(): boolean {
    return this.storedValues.alwaysShowsPlayerPageOverlay;
  }

  // TODO: Validate
  /** Whether the debug overlay on a page that is not watching a video fills the window with the player. */
  get unmonitoredOverlayFillsWindow(): boolean {
    return this.storedValues.unmonitoredOverlayFillsWindow;
  }

  // TODO: Validate
  set unmonitoredOverlayFillsWindow(unmonitoredOverlayFillsWindow: boolean) {
    void this.write({ unmonitoredOverlayFillsWindow });
  }

  // TODO: Validate
  /** Whether the debug overlay on a page that is not watching a video shows an alert when it detects the end. */
  get unmonitoredOverlayAlertsOnEnd(): boolean {
    return this.storedValues.unmonitoredOverlayAlertsOnEnd;
  }

  // TODO: Validate
  set unmonitoredOverlayAlertsOnEnd(unmonitoredOverlayAlertsOnEnd: boolean) {
    void this.write({ unmonitoredOverlayAlertsOnEnd });
  }

  // TODO: Validate
  get nextEpisodeCountdownSeconds(): number {
    return this.storedValues.nextEpisodeCountdownSeconds;
  }

  // TODO: Validate
  set nextEpisodeCountdownSeconds(nextEpisodeCountdownSeconds: number) {
    void this.write({ nextEpisodeCountdownSeconds });
  }

  // TODO: Validate
  get showsUpNextInformation(): boolean {
    return this.storedValues.showsUpNextInformation;
  }

  // TODO: Validate
  set showsUpNextInformation(showsUpNextInformation: boolean) {
    void this.write({ showsUpNextInformation });
  }

  // TODO: Validate
  get showsCondensedGuide(): boolean {
    return this.storedValues.showsCondensedGuide;
  }

  // TODO: Validate
  set showsCondensedGuide(showsCondensedGuide: boolean) {
    void this.write({ showsCondensedGuide });
  }

  // TODO: Validate
  get showsGuideSourceLogos(): boolean {
    return this.storedValues.showsGuideSourceLogos;
  }

  // TODO: Validate
  set showsGuideSourceLogos(showsGuideSourceLogos: boolean) {
    void this.write({ showsGuideSourceLogos });
  }

  // TODO: Validate
  get sizesGuideVideosByText(): boolean {
    return this.storedValues.sizesGuideVideosByText;
  }

  // TODO: Validate
  set sizesGuideVideosByText(sizesGuideVideosByText: boolean) {
    void this.write({ sizesGuideVideosByText });
  }

  // TODO: Validate
  get minimumVideoMinutes(): number {
    return this.storedValues.minimumVideoMinutes;
  }

  // TODO: Validate
  set minimumVideoMinutes(minimumVideoMinutes: number) {
    void this.write({ minimumVideoMinutes });
  }

  // TODO: Validate
  get guideDetailsHeightPercent(): number {
    return this.storedValues.guideDetailsHeightPercent;
  }

  // TODO: Validate
  set guideDetailsHeightPercent(guideDetailsHeightPercent: number) {
    void this.write({ guideDetailsHeightPercent });
  }

  // TODO: Validate
  get zoomPercent(): number {
    return this.storedValues.zoomPercent;
  }

  // TODO: Validate
  set zoomPercent(zoomPercent: number) {
    void this.write({ zoomPercent });
  }

  // TODO: Validate
  get guideScope(): GuideScope {
    return this.storedValues.guideScope;
  }

  // TODO: Validate
  set guideScope(guideScope: GuideScope) {
    void this.write({ guideScope });
  }

  // TODO: Validate
  get marksStartedVideosWatched(): boolean {
    return this.storedValues.marksStartedVideosWatched;
  }

  // TODO: Validate
  set marksStartedVideosWatched(marksStartedVideosWatched: boolean) {
    void this.write({ marksStartedVideosWatched });
  }

  // TODO: Validate
  get marksFinishedVideosCompleted(): boolean {
    return this.storedValues.marksFinishedVideosCompleted;
  }

  // TODO: Validate
  set marksFinishedVideosCompleted(marksFinishedVideosCompleted: boolean) {
    void this.write({ marksFinishedVideosCompleted });
  }

  // TODO: Validate
  get activePlayback(): ActivePlayback | null {
    return this.storedValues.activePlayback;
  }

  // TODO: Validate
  saveActivePlayback(activePlayback: ActivePlayback | null): Promise<void> {
    return this.write({ activePlayback });
  }

  // TODO: Validate
  get pendingPlaybackOutcome(): PendingPlaybackOutcome | null {
    return this.storedValues.pendingPlaybackOutcome;
  }

  // TODO: Validate
  savePendingPlaybackOutcome(pendingPlaybackOutcome: PendingPlaybackOutcome | null): Promise<void> {
    return this.write({ pendingPlaybackOutcome });
  }

  // TODO: Validate
  get accountRefreshSettings(): AccountRefreshSettings | null {
    const accountUserJson = this.storedValues.accountUserJson;
    return accountUserJson === null ? null : accountRefreshSettingsFromJson(accountUserJson);
  }

  // TODO: Validate
  signOut(): void {
    void this.write({
      accessToken: null,
      signedInDisplayName: null,
      accountUserJson: null,
      hasChosenAnonymous: false,
      guideScope: "PUBLIC",
    });
  }

  // TODO: Validate
  loadLocalSeeds(): OrderSeeds {
    return {
      minimumEpisodeOrderSeed: this.storedValues.localMinimumEpisodeOrderSeed,
      channelOrderSeed: this.storedValues.localChannelOrderSeed,
      channelIdToEpisodeOrderSeed: { ...this.storedValues.localChannelIdToEpisodeSeed },
    };
  }

  // TODO: Validate
  saveLocalChannelEpisodeSeed(channelId: string, episodeSeed: number): void {
    void this.write({
      localChannelIdToEpisodeSeed: { ...this.storedValues.localChannelIdToEpisodeSeed, [channelId]: episodeSeed },
    });
  }

  // TODO: Validate
  advanceLocalChannelOrderSeed(): void {
    void this.write({ localChannelOrderSeed: this.storedValues.localChannelOrderSeed + 1 });
  }

  // TODO: Validate
  advanceLocalMinimumEpisodeSeed(): void {
    const orderSeeds = this.loadLocalSeeds();
    const highestEpisodeSeed = Math.max(
      ...Object.values(orderSeeds.channelIdToEpisodeOrderSeed),
      orderSeeds.minimumEpisodeOrderSeed,
    );
    void this.write({ localMinimumEpisodeOrderSeed: highestEpisodeSeed + 1, localChannelIdToEpisodeSeed: {} });
  }

  // TODO: Validate
  readWatchedEpisodeIds(): Set<string> {
    return new Set(Object.keys(this.storedValues.watchedEpisodeIdToWatchedAt));
  }

  // TODO: Validate
  rememberWatchedEpisode(episodeId: string): void {
    const newestWatchedEntries = Object.entries({
      ...this.storedValues.watchedEpisodeIdToWatchedAt,
      [episodeId]: Date.now(),
    })
      .sort(([, firstWatchedAt], [, secondWatchedAt]) => secondWatchedAt - firstWatchedAt)
      .slice(0, 2000);
    void this.write({ watchedEpisodeIdToWatchedAt: Object.fromEntries(newestWatchedEntries) });
  }

  // TODO: Validate
  forgetWatchedEpisode(episodeId: string): void {
    const remainingWatchedEpisodes = { ...this.storedValues.watchedEpisodeIdToWatchedAt };
    delete remainingWatchedEpisodes[episodeId];
    void this.write({ watchedEpisodeIdToWatchedAt: remainingWatchedEpisodes });
  }

  // TODO: Validate
  private accountStreamingProfileJson(streamingServiceKey: string): JsonObject | null {
    if (!this.isSignedIn) return null;
    const pluginKeyToProfileJson = optionalObject(this.storedValues.accountUserJson ?? {}, "plugin_key_to_profile");
    return pluginKeyToProfileJson === null ? null : optionalObject(pluginKeyToProfileJson, streamingServiceKey);
  }

  // TODO: Validate
  replaceAccountStreamingProfiles(pluginKeyToProfileJson: JsonObject): void {
    this.updateAccountUserJson((accountUserJson) => {
      accountUserJson.plugin_key_to_profile = pluginKeyToProfileJson;
    });
  }

  // TODO: Validate
  saveSignedInUser(signedInUser: SignedInUser): void {
    void this.write({ accountUserJson: signedInUser.userJson, signedInDisplayName: signedInUser.username });
  }

  // TODO: Validate
  replaceAccountChannelRefreshSettings(channelId: string, channelRefreshSettings: ChannelRefreshSettings): void {
    this.updateAccountUserJson((accountUserJson) => {
      const savedChannelIdToRefreshSettings = accountUserJson.channel_id_to_refresh_settings;
      const channelIdToRefreshSettingsJson: JsonObject = isJsonObject(savedChannelIdToRefreshSettings)
        ? { ...savedChannelIdToRefreshSettings }
        : {};
      if (followsAccountDefaults(channelRefreshSettings)) {
        delete channelIdToRefreshSettingsJson[channelId];
      } else {
        channelIdToRefreshSettingsJson[channelId] = channelRefreshSettingsJson(channelRefreshSettings);
      }
      accountUserJson.channel_id_to_refresh_settings = channelIdToRefreshSettingsJson;
    });
  }

  // TODO: Validate
  private updateAccountUserJson(updateSavedAccountUserJson: (accountUserJson: JsonObject) => void): void {
    const savedAccountUserJson: JsonObject = structuredClone(this.storedValues.accountUserJson ?? {});
    updateSavedAccountUserJson(savedAccountUserJson);
    void this.write({ accountUserJson: savedAccountUserJson });
  }

  // TODO: Validate
  /** Returns the last autoplay check of the streaming site named pluginKey, or null when it was never checked. */
  autoplayCheck(pluginKey: string): AutoplayCheck | null {
    return this.storedValues.pluginKeyToAutoplayCheck[pluginKey] ?? null;
  }

  // TODO: Validate
  writeAutoplayCheck(pluginKey: string, autoplayCheck: AutoplayCheck): void {
    void this.write({
      pluginKeyToAutoplayCheck: { ...this.storedValues.pluginKeyToAutoplayCheck, [pluginKey]: autoplayCheck },
    });
  }

  // TODO: Validate
  /** Returns the settings of the streaming site named pluginKey, with defaults for the settings it has not saved. */
  streamingSiteSettings(pluginKey: string): StreamingSiteSettings {
    return { ...DEFAULT_STREAMING_SITE_SETTINGS, ...this.storedValues.pluginKeyToStreamingSiteSettings[pluginKey] };
  }

  // TODO: Validate
  /** Saves changedSiteSettings for every streaming site in pluginKeys at once. */
  writeStreamingSiteSettings(pluginKeys: string[], changedSiteSettings: Partial<StreamingSiteSettings>): void {
    const pluginKeyToStreamingSiteSettings = { ...this.storedValues.pluginKeyToStreamingSiteSettings };
    for (const pluginKey of pluginKeys) {
      pluginKeyToStreamingSiteSettings[pluginKey] = {
        ...pluginKeyToStreamingSiteSettings[pluginKey],
        ...changedSiteSettings,
      };
    }
    void this.write({ pluginKeyToStreamingSiteSettings });
  }

  // TODO: Validate
  streamingProfileName(streamingServiceKey: string): string {
    const accountStreamingProfileJson = this.accountStreamingProfileJson(streamingServiceKey);
    if (accountStreamingProfileJson !== null) return optionalString(accountStreamingProfileJson, "profile_name") ?? "";
    return this.storedValues.settingsKeyToDeviceStreamingProfile[streamingServiceKey]?.profileName ?? "";
  }

  // TODO: Validate
  streamingProfilePin(streamingServiceKey: string): string {
    const accountStreamingProfileJson = this.accountStreamingProfileJson(streamingServiceKey);
    if (accountStreamingProfileJson !== null) return optionalString(accountStreamingProfileJson, "pin") ?? "";
    return this.storedValues.settingsKeyToDeviceStreamingProfile[streamingServiceKey]?.profilePin ?? "";
  }

  // TODO: Validate
  writeStreamingProfile(streamingServiceKey: string, profileName: string, profilePin: string): void {
    this.writeDeviceStreamingProfile(streamingServiceKey, { profileName, profilePin });
  }

  // TODO: Validate
  private writeDeviceStreamingProfile(
    streamingServiceKey: string,
    changedProfileFields: Partial<DeviceStreamingProfile>,
  ): void {
    const savedDeviceStreamingProfile = this.storedValues.settingsKeyToDeviceStreamingProfile[streamingServiceKey] ?? {
      profileName: "",
      profilePin: "",
    };
    void this.write({
      settingsKeyToDeviceStreamingProfile: {
        ...this.storedValues.settingsKeyToDeviceStreamingProfile,
        [streamingServiceKey]: { ...savedDeviceStreamingProfile, ...changedProfileFields },
      },
    });
  }
}

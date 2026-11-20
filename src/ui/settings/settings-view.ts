// TODO: Validate

import {
  DEFAULT_GUIDE_DETAILS_HEIGHT_PERCENT,
  DEFAULT_MINIMUM_VIDEO_MINUTES,
  DEFAULT_ZOOM_PERCENT,
} from "../../data/local-app-storage";
import type { AutoplayCheck } from "../../playback/autoplay-check";
import { stopAnnouncement } from "../../playback/up-next-announcer";
import type { StreamChannelerApp } from "../../stream-channeler-app";
import { ALL_STREAMING_SITES, hasProfileScreen, type StreamingSite } from "../../streamingsites/streaming-site";
import {
  ALWAYS_ON_PLAY_NEXT_EPISODE_MOMENT,
  PLAY_NEXT_EPISODE_MOMENTS_IN_ORDER,
  type PlayNextEpisodeWhen,
  playNextEpisodeWhenChoices,
  playNextEpisodeWhenLabel,
  STREAMING_SITE_TOGGLE_SETTINGS,
  type StreamingSiteToggleSetting,
} from "../../streamingsites/streaming-site-settings";
import type { AppView } from "../common/app-view";
import { showDialog } from "../common/dialogs";
import { clickFocusedElement, moveFocusAmong, type RemoteAction } from "../common/remote-input";
import { actionButton, applyZoom, textInput, textLabel } from "../common/ui";

// The first two sentences are shown in red, so they are kept apart from the rest of the warning.
const STREAMING_PROFILE_WARNING_RED_SENTENCES =
  "Profile names and PINs are not encrypted. They are stored and sent as plain text, and any device signed in " +
  "to your account can read them.";
const STREAMING_PROFILE_WARNING_REST =
  " Streaming service PINs are not treated as real account security because " +
  "almost every service lets you remove a forgotten PIN from your account. If a PIN here is the same as one " +
  "you use for anything that matters, like a credit card, don't save it here, and consider using different " +
  "PINs for your credit card and your streaming services.";
// The Android app's Permissions section has no browser equivalent. The closest browser setup is letting the
// streaming websites autoplay with sound and keeping the browser full screen, so this note explains those instead.
const BROWSER_AUTOPLAY_NOTE =
  "For the next video to start with sound, the browser has to let each streaming website autoplay. Allowing " +
  "Sound for the website in the browser's site settings usually covers this. A dedicated TV browser can also be " +
  "started with --autoplay-policy=no-user-gesture-required. Use the browser's full screen mode (F11) or --kiosk " +
  "to stay full screen.";

/** A switch's position. MIXED is for a switch covering several websites whose settings differ. */
type SwitchState = boolean | "MIXED";

// TODO: Validate
export class SettingsView implements AppView {
  readonly rootElement: HTMLElement;
  private readonly app: StreamChannelerApp;
  private readonly afterVideoEndsButton: HTMLButtonElement;
  private readonly upNextInformationButton: HTMLButtonElement;
  private readonly nextEpisodeCountdownInput: HTMLInputElement;
  private readonly markStartedVideosWatchedButton: HTMLButtonElement;
  private readonly markFinishedVideosCompletedButton: HTMLButtonElement;
  private readonly condensedGuideButton: HTMLButtonElement;
  private readonly minimumVideoMinutesInput: HTMLInputElement;
  private readonly guideSourceLogosButton: HTMLButtonElement;
  private readonly guideVideosSizedByTextButton: HTMLButtonElement;
  private readonly guideDetailsHeightInput: HTMLInputElement;
  private readonly zoomInput: HTMLInputElement;
  private readonly accountButton: HTMLButtonElement;
  private readonly showDebugInformationButton: HTMLButtonElement;
  private readonly playerPageOverlayButton: HTMLButtonElement;
  private readonly settingsTabButtons: HTMLButtonElement[] = [];
  private readonly settingsTabPanels: HTMLDivElement[] = [];
  private shownSettingsTabIndex = 0;
  // The per-website rows are made in loops, so each row keeps the function that writes its label.
  private readonly websiteSettingRowLabelWriters: (() => void)[] = [];
  // A change on the All websites tab can overwrite many websites at once, so it stays unsaved until its Save
  // button is chosen. These hold the unsaved changes. A null value or a missing key means there is none.
  private readonly allWebsitesUnsavedPlayNextEpisodeMomentChecks = new Map<PlayNextEpisodeWhen, boolean>();
  private readonly allWebsitesUnsavedToggleSettingValues = new Map<StreamingSiteToggleSetting, boolean>();
  private allWebsitesUnsavedStreamingProfileName: string | null = null;
  private allWebsitesUnsavedStreamingProfilePin: string | null = null;
  private readonly sortedStreamingSites = [...ALL_STREAMING_SITES].sort((firstSite, secondSite) =>
    firstSite.pluginKey.localeCompare(secondSite.pluginKey),
  );
  // TODO: Validate
  private readonly renderSettingsOnStoredValuesChange = () => this.renderSettings();
  private readonly streamingSitesWithProfileScreens = ALL_STREAMING_SITES.filter((streamingSite) =>
    hasProfileScreen(streamingSite),
  ).sort((firstSite, secondSite) => firstSite.pluginKey.localeCompare(secondSite.pluginKey));
  private readonly streamingSitesWithProfilePins = this.streamingSitesWithProfileScreens.filter(
    (profileStreamingSite) => profileStreamingSite.pinEntry !== undefined,
  );

  // TODO: Validate
  constructor(app: StreamChannelerApp) {
    this.app = app;
    this.afterVideoEndsButton = settingButton(() => this.toggleAfterVideoEnds());
    this.upNextInformationButton = settingButton(() => this.toggleUpNextInformation());
    this.nextEpisodeCountdownInput = numberSettingInput(0, 60, 0, (enteredCountdownSeconds) => {
      this.app.preferences.nextEpisodeCountdownSeconds = enteredCountdownSeconds;
      this.renderSettings();
    });
    this.markStartedVideosWatchedButton = settingButton(() => this.toggleMarkStartedVideosWatched());
    this.markFinishedVideosCompletedButton = settingButton(() => this.toggleMarkFinishedVideosCompleted());
    this.condensedGuideButton = settingButton(() => this.toggleCondensedGuide());
    this.minimumVideoMinutesInput = numberSettingInput(
      0,
      120,
      DEFAULT_MINIMUM_VIDEO_MINUTES,
      (enteredMinimumVideoMinutes) => {
        this.app.preferences.minimumVideoMinutes = enteredMinimumVideoMinutes;
        this.renderSettings();
      },
    );
    this.guideSourceLogosButton = settingButton(() => this.toggleGuideSourceLogos());
    this.guideVideosSizedByTextButton = settingButton(() => this.toggleGuideVideosSizedByText());
    this.guideDetailsHeightInput = numberSettingInput(
      5,
      60,
      DEFAULT_GUIDE_DETAILS_HEIGHT_PERCENT,
      (enteredGuideDetailsHeightPercent) => {
        this.app.preferences.guideDetailsHeightPercent = enteredGuideDetailsHeightPercent;
        this.renderSettings();
      },
    );
    // The same range as the browser's own zoom.
    this.zoomInput = numberSettingInput(25, 500, DEFAULT_ZOOM_PERCENT, (enteredZoomPercent) => {
      this.app.preferences.zoomPercent = enteredZoomPercent;
      applyZoom(enteredZoomPercent);
      this.renderSettings();
    });
    this.accountButton = settingButton(() => this.app.signOutAndShowLogin());
    this.showDebugInformationButton = settingButton(() => this.showDebugInformation());
    this.showDebugInformationButton.textContent = "Show debug information";
    this.playerPageOverlayButton = settingButton(() => this.togglePlayerPageOverlay());

    this.rootElement = document.createElement("div");
    this.rootElement.className = "settings-screen";
    const settingsColumn = document.createElement("div");
    settingsColumn.className = "settings-column";
    // Keyboards, remotes and gamepads close settings with Back. The Close button is for a mouse or a touch screen.
    const settingsHeader = document.createElement("div");
    settingsHeader.className = "settings-header";
    settingsHeader.append(
      textLabel("Settings", "settings-title"),
      actionButton("Close", () => this.app.closeTopView()),
    );
    const generalSettingsPanel = settingsTabPanel();
    generalSettingsPanel.append(
      sectionHeading("Playback"),
      this.afterVideoEndsButton,
      this.upNextInformationButton,
      numberSettingRow(
        "Countdown before the next episode, in seconds (0 turns it off, and Back cancels it)",
        this.nextEpisodeCountdownInput,
      ),
      this.markStartedVideosWatchedButton,
      this.markFinishedVideosCompletedButton,
      sectionHeading("Guide"),
      this.condensedGuideButton,
      this.guideSourceLogosButton,
      this.guideVideosSizedByTextButton,
      numberSettingRow(
        `Stretch videos shorter than this many minutes so their titles fit in the guide (0 turns it off, default ${DEFAULT_MINIMUM_VIDEO_MINUTES})`,
        this.minimumVideoMinutesInput,
      ),
      numberSettingRow(
        `Height of the details above the guide, in percent of the window (default ${DEFAULT_GUIDE_DETAILS_HEIGHT_PERCENT})`,
        this.guideDetailsHeightInput,
      ),
      numberSettingRow(`Zoom, in percent (default ${DEFAULT_ZOOM_PERCENT})`, this.zoomInput),
      sectionHeading("Browser"),
      textLabel(BROWSER_AUTOPLAY_NOTE, "settings-note"),
      textLabel(upNextSpeechNote(), "settings-note"),
      sectionHeading("Account"),
      this.accountButton,
      sectionHeading("Debugging"),
      this.showDebugInformationButton,
      this.playerPageOverlayButton,
      textLabel(`Version ${GM_info.script.version}`, "settings-version"),
    );
    this.addSettingsTab("General", null, generalSettingsPanel);
    this.addSettingsTab("All websites", null, this.allWebsitesSettingsPanel());
    this.addSettingsTab("Autoplay", null, this.autoplaySettingsPanel());
    for (const streamingSite of this.sortedStreamingSites) {
      this.addSettingsTab(streamingSite.pluginKey, streamingSite.faviconUrl, this.websiteSettingsPanel(streamingSite));
    }
    const settingsTabList = document.createElement("div");
    settingsTabList.className = "settings-tab-list";
    settingsTabList.append(...this.settingsTabButtons);
    const settingsTabsAndPanels = document.createElement("div");
    settingsTabsAndPanels.className = "settings-tabs-and-panels";
    settingsTabsAndPanels.append(settingsTabList, ...this.settingsTabPanels);
    settingsColumn.append(settingsHeader, settingsTabsAndPanels);
    this.rootElement.append(settingsColumn);
    this.showSettingsTab(0);
  }

  // TODO: Validate
  private addSettingsTab(tabName: string, tabFaviconUrl: string | null, tabPanel: HTMLDivElement): void {
    const settingsTabIndex = this.settingsTabButtons.length;
    const settingsTabButton = actionButton(tabName, () => this.showSettingsTab(settingsTabIndex), "settings-tab");
    if (tabFaviconUrl !== null) {
      const tabFaviconImage = document.createElement("img");
      tabFaviconImage.className = "settings-tab-favicon";
      tabFaviconImage.alt = "";
      this.app.imageLoader.loadInto(tabFaviconImage, tabFaviconUrl);
      settingsTabButton.prepend(tabFaviconImage);
    }
    this.settingsTabButtons.push(settingsTabButton);
    this.settingsTabPanels.push(tabPanel);
  }

  // TODO: Validate
  private showSettingsTab(settingsTabIndex: number): void {
    this.shownSettingsTabIndex = settingsTabIndex;
    for (const [tabIndex, settingsTabButton] of this.settingsTabButtons.entries()) {
      settingsTabButton.classList.toggle("is-activated", tabIndex === settingsTabIndex);
    }
    for (const [tabIndex, settingsTabPanel] of this.settingsTabPanels.entries()) {
      settingsTabPanel.hidden = tabIndex !== settingsTabIndex;
    }
  }

  // TODO: Validate
  /** Shows the tab moveDirection steps away, and focuses its first setting so a remote can keep going. */
  private moveSettingsTab(moveDirection: -1 | 1): void {
    const tabCount = this.settingsTabButtons.length;
    this.showSettingsTab((this.shownSettingsTabIndex + moveDirection + tabCount) % tabCount);
    this.settingsTabPanels[this.shownSettingsTabIndex]?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  // TODO: Validate
  /**
   * Lists whether each streaming site may start with sound on its own. The browser does not let a page change that,
   * so each row opens its site, where the viewer can allow sound in the browser's site settings.
   */
  private autoplaySettingsPanel(): HTMLDivElement {
    const autoplayPanel = settingsTabPanel();
    autoplayPanel.append(
      textLabel(
        "Each website is checked whenever it opens. To let a blocked website start with sound, select it to open it, " +
          "then allow Sound in the browser's site settings for it, usually from the icon next to its address.",
        "settings-note",
      ),
    );
    for (const streamingSite of this.sortedStreamingSites) {
      this.addWebsiteSettingRow(
        autoplayPanel,
        () => window.open(`https://${streamingSite.domains[0]}/`, "_blank", "noopener"),
        (autoplaySettingButton) =>
          writeValueSettingRow(
            autoplaySettingButton,
            streamingSite.pluginKey,
            autoplayCheckLabel(this.app.preferences.autoplayCheck(streamingSite.pluginKey)),
          ),
      );
    }
    return autoplayPanel;
  }

  // TODO: Validate
  private allWebsitesSettingsPanel(): HTMLDivElement {
    const allWebsitesPanel = settingsTabPanel();
    allWebsitesPanel.append(
      textLabel(
        "A change here is not saved until you choose the Save button next to it. Saving applies it to every " +
          "website that has the feature. Each website's own tab can change it again.",
        "settings-note",
      ),
    );
    allWebsitesPanel.append(sectionHeading("Play the next episode when"));
    for (const playNextEpisodeMoment of PLAY_NEXT_EPISODE_MOMENTS_IN_ORDER) {
      // A moment that is a site's always-on moment cannot be unchecked there, so those sites are left out.
      const checkableStreamingSites = this.sortedStreamingSites.filter(
        (streamingSite) =>
          playNextEpisodeWhenChoices(streamingSite).includes(playNextEpisodeMoment) &&
          playNextEpisodeMoment !== ALWAYS_ON_PLAY_NEXT_EPISODE_MOMENT,
      );
      if (checkableStreamingSites.length === 0) continue;
      // TODO: Validate
      const isMomentCheckedForEverySite = () =>
        checkableStreamingSites.every((streamingSite) =>
          this.isPlayNextEpisodeMomentChecked(streamingSite, playNextEpisodeMoment),
        );
      this.addAllWebsitesSettingRow(allWebsitesPanel, {
        streamingSites: checkableStreamingSites,
        onChosen: () => {
          const unsavedMomentCheck = this.allWebsitesUnsavedPlayNextEpisodeMomentChecks.get(playNextEpisodeMoment);
          this.allWebsitesUnsavedPlayNextEpisodeMomentChecks.set(
            playNextEpisodeMoment,
            unsavedMomentCheck === undefined ? !isMomentCheckedForEverySite() : !unsavedMomentCheck,
          );
        },
        hasUnsavedChange: () => {
          const unsavedMomentCheck = this.allWebsitesUnsavedPlayNextEpisodeMomentChecks.get(playNextEpisodeMoment);
          return (
            unsavedMomentCheck !== undefined &&
            this.momentSwitchState(checkableStreamingSites, playNextEpisodeMoment) !== unsavedMomentCheck
          );
        },
        onSaved: () => {
          const unsavedMomentCheck = this.allWebsitesUnsavedPlayNextEpisodeMomentChecks.get(playNextEpisodeMoment);
          if (unsavedMomentCheck === undefined) return;
          this.setPlayNextEpisodeMomentChecked(checkableStreamingSites, playNextEpisodeMoment, unsavedMomentCheck);
          this.allWebsitesUnsavedPlayNextEpisodeMomentChecks.delete(playNextEpisodeMoment);
        },
        writeSettingRow: (allWebsitesSettingButton) => {
          const unsavedMomentCheck = this.allWebsitesUnsavedPlayNextEpisodeMomentChecks.get(playNextEpisodeMoment);
          return writeSwitchSettingRow(
            allWebsitesSettingButton,
            playNextEpisodeWhenLabel(playNextEpisodeMoment),
            unsavedMomentCheck ?? this.momentSwitchState(checkableStreamingSites, playNextEpisodeMoment),
          );
        },
      });
    }
    allWebsitesPanel.append(
      textLabel(
        "Each website's last moment, usually the episode ending, is always on, so every video ends.",
        "settings-note",
      ),
    );
    for (const toggleSetting of STREAMING_SITE_TOGGLE_SETTINGS) {
      const toggleStreamingSites = this.sortedStreamingSites.filter((streamingSite) =>
        toggleSetting.isSupportedBy(streamingSite),
      );
      if (toggleStreamingSites.length === 0) continue;
      // TODO: Validate
      const isToggleSettingOnForEverySite = () =>
        toggleStreamingSites.every((streamingSite) =>
          toggleSetting.isOnIn(this.app.preferences.streamingSiteSettings(streamingSite.pluginKey)),
        );
      this.addAllWebsitesSettingRow(allWebsitesPanel, {
        streamingSites: toggleStreamingSites,
        // The first choice matches the website tabs. It turns the setting off when every site has it on, and on otherwise.
        onChosen: () => {
          const unsavedToggleSettingValue = this.allWebsitesUnsavedToggleSettingValues.get(toggleSetting);
          this.allWebsitesUnsavedToggleSettingValues.set(
            toggleSetting,
            unsavedToggleSettingValue === undefined ? !isToggleSettingOnForEverySite() : !unsavedToggleSettingValue,
          );
        },
        hasUnsavedChange: () => {
          const unsavedToggleSettingValue = this.allWebsitesUnsavedToggleSettingValues.get(toggleSetting);
          return (
            unsavedToggleSettingValue !== undefined &&
            this.toggleSettingSwitchState(toggleStreamingSites, toggleSetting) !== unsavedToggleSettingValue
          );
        },
        onSaved: () => {
          const unsavedToggleSettingValue = this.allWebsitesUnsavedToggleSettingValues.get(toggleSetting);
          if (unsavedToggleSettingValue === undefined) return;
          this.setToggleSetting(toggleStreamingSites, toggleSetting, unsavedToggleSettingValue);
          this.allWebsitesUnsavedToggleSettingValues.delete(toggleSetting);
        },
        writeSettingRow: (allWebsitesSettingButton) =>
          writeSwitchSettingRow(
            allWebsitesSettingButton,
            toggleSetting.label,
            this.allWebsitesUnsavedToggleSettingValues.get(toggleSetting) ??
              this.toggleSettingSwitchState(toggleStreamingSites, toggleSetting),
          ),
      });
    }
    if (this.streamingSitesWithProfileScreens.length > 0) {
      allWebsitesPanel.append(sectionHeading("Streaming profile"), streamingProfileWarning());
      this.addAllWebsitesSettingRow(allWebsitesPanel, {
        onChosen: () => this.editAllWebsitesStreamingProfileName(),
        hasUnsavedChange: () => this.allWebsitesUnsavedStreamingProfileName !== null,
        onSaved: () => {
          const unsavedProfileName = this.allWebsitesUnsavedStreamingProfileName;
          if (unsavedProfileName === null) return;
          this.saveStreamingProfiles(
            this.streamingSitesWithProfileScreens.map((profileStreamingSite) => ({
              profileStreamingSite,
              profileName: unsavedProfileName,
              profilePin: this.app.preferences.streamingProfilePin(profileStreamingSite.pluginKey),
            })),
          );
          this.allWebsitesUnsavedStreamingProfileName = null;
        },
        writeSettingRow: (allWebsitesSettingButton) =>
          writeValueSettingRow(
            allWebsitesSettingButton,
            "Profile name on every website",
            this.allWebsitesStreamingProfileNameLabel(),
          ),
      });
    }
    if (this.streamingSitesWithProfilePins.length > 0) {
      this.addAllWebsitesSettingRow(allWebsitesPanel, {
        streamingSites: this.streamingSitesWithProfilePins,
        onChosen: () => this.editAllWebsitesStreamingProfilePin(),
        hasUnsavedChange: () => this.allWebsitesUnsavedStreamingProfilePin !== null,
        onSaved: () => {
          const unsavedProfilePin = this.allWebsitesUnsavedStreamingProfilePin;
          if (unsavedProfilePin === null) return;
          this.saveStreamingProfiles(
            this.streamingSitesWithProfilePins.map((pinStreamingSite) => ({
              profileStreamingSite: pinStreamingSite,
              profileName: this.app.preferences.streamingProfileName(pinStreamingSite.pluginKey),
              profilePin: unsavedProfilePin,
            })),
          );
          this.allWebsitesUnsavedStreamingProfilePin = null;
        },
        writeSettingRow: (allWebsitesSettingButton) =>
          writeValueSettingRow(
            allWebsitesSettingButton,
            "Profile PIN on every website",
            this.allWebsitesStreamingProfilePinLabel(),
          ),
      });
    }
    return allWebsitesPanel;
  }

  // TODO: Validate
  private websiteSettingsPanel(streamingSite: StreamingSite): HTMLDivElement {
    const websitePanel = settingsTabPanel();
    websitePanel.append(sectionHeading(streamingSite.pluginKey));
    websitePanel.append(sectionHeading("Play the next episode when"));
    for (const playNextEpisodeMoment of playNextEpisodeWhenChoices(streamingSite)) {
      if (playNextEpisodeMoment === ALWAYS_ON_PLAY_NEXT_EPISODE_MOMENT) {
        // The always-on moment cannot be unchecked, so that every video ends.
        const alwaysOnMomentButton = settingButton(() => undefined);
        writeSwitchSettingRow(
          alwaysOnMomentButton,
          `${playNextEpisodeWhenLabel(playNextEpisodeMoment)} (always on)`,
          true,
        );
        alwaysOnMomentButton.disabled = true;
        websitePanel.append(alwaysOnMomentButton);
        continue;
      }
      this.addWebsiteSettingRow(
        websitePanel,
        () =>
          this.setPlayNextEpisodeMomentChecked(
            [streamingSite],
            playNextEpisodeMoment,
            !this.isPlayNextEpisodeMomentChecked(streamingSite, playNextEpisodeMoment),
          ),
        (momentSettingButton) =>
          writeSwitchSettingRow(
            momentSettingButton,
            playNextEpisodeWhenLabel(playNextEpisodeMoment),
            this.momentSwitchState([streamingSite], playNextEpisodeMoment),
          ),
      );
    }
    if (streamingSiteSupportsAnyToggle(streamingSite)) websitePanel.append(sectionHeading("While watching"));
    for (const toggleSetting of STREAMING_SITE_TOGGLE_SETTINGS) {
      if (!toggleSetting.isSupportedBy(streamingSite)) continue;
      this.addWebsiteSettingRow(
        websitePanel,
        () => this.toggleWebsiteSetting([streamingSite], toggleSetting),
        (toggleSettingButton) =>
          writeSwitchSettingRow(
            toggleSettingButton,
            toggleSetting.label,
            this.toggleSettingSwitchState([streamingSite], toggleSetting),
          ),
      );
    }
    if (hasProfileScreen(streamingSite)) {
      websitePanel.append(sectionHeading("Streaming profile"), streamingProfileWarning());
      this.addWebsiteSettingRow(
        websitePanel,
        () => this.editStreamingProfileName(streamingSite),
        (profileNameButton) =>
          writeValueSettingRow(
            profileNameButton,
            `${streamingSite.pluginKey} profile name`,
            this.app.preferences.streamingProfileName(streamingSite.pluginKey) || "None, you pick it",
          ),
      );
      if (streamingSite.pinEntry !== undefined) {
        this.addWebsiteSettingRow(
          websitePanel,
          () => this.editStreamingProfilePin(streamingSite),
          (profilePinButton) =>
            writeValueSettingRow(
              profilePinButton,
              `${streamingSite.pluginKey} profile PIN`,
              hiddenProfilePinLabel(this.app.preferences.streamingProfilePin(streamingSite.pluginKey)),
            ),
        );
      }
    }
    return websitePanel;
  }

  // TODO: Validate
  private addWebsiteSettingRow(
    settingsPanel: HTMLDivElement,
    onChosen: () => void,
    writeSettingRow: (websiteSettingButton: HTMLButtonElement) => void,
  ): void {
    const websiteSettingButton = settingButton(() => {
      onChosen();
      this.renderSettings();
    });
    settingsPanel.append(websiteSettingButton);
    this.websiteSettingRowLabelWriters.push(() => writeSettingRow(websiteSettingButton));
  }

  // TODO: Validate
  /**
   * Adds a row whose value button only changes an unsaved value, and whose Save button writes that value. The
   * Save button is disabled while there is nothing to save.
   */
  private addAllWebsitesSettingRow(
    settingsPanel: HTMLDivElement,
    allWebsitesSettingRow: {
      /** The sites the row applies to. Their favicons follow the row's text in place of their names. */
      streamingSites?: StreamingSite[];
      onChosen: () => void;
      hasUnsavedChange: () => boolean;
      onSaved: () => void;
      /** Fills the row's value button and returns its label, which gets the unsaved note and the favicons. */
      writeSettingRow: (allWebsitesSettingButton: HTMLButtonElement) => HTMLSpanElement;
    },
  ): void {
    const allWebsitesSettingButton = settingButton(() => {
      allWebsitesSettingRow.onChosen();
      this.renderSettings();
    });
    const allWebsitesSaveButton = actionButton("Save", () => {
      allWebsitesSettingRow.onSaved();
      this.renderSettings();
      // The Save button is disabled once its change is saved, so focus goes back to the value for a remote.
      allWebsitesSettingButton.focus();
    });
    const streamingSiteFavicons = this.streamingSiteFavicons(allWebsitesSettingRow.streamingSites ?? []);
    const allWebsitesSettingRowElement = document.createElement("div");
    allWebsitesSettingRowElement.className = "all-websites-setting-row";
    allWebsitesSettingRowElement.append(allWebsitesSettingButton, allWebsitesSaveButton);
    settingsPanel.append(allWebsitesSettingRowElement);
    this.websiteSettingRowLabelWriters.push(() => {
      const hasUnsavedChange = allWebsitesSettingRow.hasUnsavedChange();
      const allWebsitesSettingLabel = allWebsitesSettingRow.writeSettingRow(allWebsitesSettingButton);
      if (hasUnsavedChange) allWebsitesSettingLabel.append(" (not saved)");
      // Writing the row replaces the label, so the favicons are added back to the new label each time.
      if (streamingSiteFavicons !== null) allWebsitesSettingLabel.append(streamingSiteFavicons);
      allWebsitesSaveButton.disabled = !hasUnsavedChange;
    });
  }

  // TODO: Validate
  /** Returns a row of the favicons of streamingSites, each named by its site for screen readers and on hover. */
  private streamingSiteFavicons(streamingSites: StreamingSite[]): HTMLSpanElement | null {
    if (streamingSites.length === 0) return null;
    const streamingSiteFaviconRow = document.createElement("span");
    streamingSiteFaviconRow.className = "setting-button-favicons";
    for (const streamingSite of streamingSites) {
      const streamingSiteFavicon = document.createElement("img");
      streamingSiteFavicon.className = "setting-button-favicon";
      streamingSiteFavicon.alt = streamingSite.pluginKey;
      streamingSiteFavicon.title = streamingSite.pluginKey;
      this.app.imageLoader.loadInto(streamingSiteFavicon, streamingSite.faviconUrl);
      streamingSiteFaviconRow.append(streamingSiteFavicon);
    }
    return streamingSiteFaviconRow;
  }

  // TODO: Validate
  private isPlayNextEpisodeMomentChecked(
    streamingSite: StreamingSite,
    playNextEpisodeMoment: PlayNextEpisodeWhen,
  ): boolean {
    return this.app.preferences
      .streamingSiteSettings(streamingSite.pluginKey)
      .checkedPlayNextEpisodeMoments.includes(playNextEpisodeMoment);
  }

  // TODO: Validate
  /** Returns whether playNextEpisodeMoment is checked across streamingSites, or "MIXED" when they differ. */
  private momentSwitchState(streamingSites: StreamingSite[], playNextEpisodeMoment: PlayNextEpisodeWhen): SwitchState {
    const momentCheckValues = new Set(
      streamingSites.map((streamingSite) => this.isPlayNextEpisodeMomentChecked(streamingSite, playNextEpisodeMoment)),
    );
    if (momentCheckValues.size > 1) return "MIXED";
    return momentCheckValues.has(true);
  }

  // TODO: Validate
  private setPlayNextEpisodeMomentChecked(
    streamingSites: StreamingSite[],
    playNextEpisodeMoment: PlayNextEpisodeWhen,
    isMomentChecked: boolean,
  ): void {
    // Each site keeps its own other checked moments, so every site is written on its own.
    for (const streamingSite of streamingSites) {
      const otherCheckedMoments = this.app.preferences
        .streamingSiteSettings(streamingSite.pluginKey)
        .checkedPlayNextEpisodeMoments.filter((checkedMoment) => checkedMoment !== playNextEpisodeMoment);
      this.app.preferences.writeStreamingSiteSettings([streamingSite.pluginKey], {
        checkedPlayNextEpisodeMoments: isMomentChecked
          ? [...otherCheckedMoments, playNextEpisodeMoment]
          : otherCheckedMoments,
      });
    }
  }

  // TODO: Validate
  private toggleSettingSwitchState(
    streamingSites: StreamingSite[],
    toggleSetting: StreamingSiteToggleSetting,
  ): SwitchState {
    const toggleSettingValues = new Set(
      streamingSites.map((streamingSite) =>
        toggleSetting.isOnIn(this.app.preferences.streamingSiteSettings(streamingSite.pluginKey)),
      ),
    );
    if (toggleSettingValues.size > 1) return "MIXED";
    return toggleSettingValues.has(true);
  }

  // TODO: Validate
  /** Turns toggleSetting off for every site in streamingSites when all of them have it on, and on otherwise. */
  private toggleWebsiteSetting(streamingSites: StreamingSite[], toggleSetting: StreamingSiteToggleSetting): void {
    const isOnForEverySite = streamingSites.every((streamingSite) =>
      toggleSetting.isOnIn(this.app.preferences.streamingSiteSettings(streamingSite.pluginKey)),
    );
    this.setToggleSetting(streamingSites, toggleSetting, !isOnForEverySite);
  }

  // TODO: Validate
  private setToggleSetting(
    streamingSites: StreamingSite[],
    toggleSetting: StreamingSiteToggleSetting,
    isTurnedOn: boolean,
  ): void {
    // A toggle can change a list that holds the site's other choices, so every site is written on its own.
    for (const streamingSite of streamingSites) {
      const currentSiteSettings = this.app.preferences.streamingSiteSettings(streamingSite.pluginKey);
      this.app.preferences.writeStreamingSiteSettings(
        [streamingSite.pluginKey],
        toggleSetting.settingsChange(currentSiteSettings, isTurnedOn),
      );
    }
  }

  // TODO: Validate
  onShown(): void {
    // Settings are shared with the streaming websites' tabs and refreshed from the account, so they can change
    // while this screen is open. The Android app re-reads them whenever its settings screen comes back.
    this.app.preferences.addChangeListener(this.renderSettingsOnStoredValuesChange);
    this.renderSettings();
    this.afterVideoEndsButton.focus();
  }

  // TODO: Validate
  onHidden(): void {
    this.app.preferences.removeChangeListener(this.renderSettingsOnStoredValuesChange);
    // Unsaved All websites changes are dropped when settings close, so an old unsaved change does not show up later.
    this.allWebsitesUnsavedPlayNextEpisodeMomentChecks.clear();
    this.allWebsitesUnsavedToggleSettingValues.clear();
    this.allWebsitesUnsavedStreamingProfileName = null;
    this.allWebsitesUnsavedStreamingProfilePin = null;
  }

  // TODO: Validate
  handleRemoteAction(remoteAction: RemoteAction): boolean {
    // The tabs are changed with left and right, so up and down only move among the shown tab's settings and Close.
    const settingControls = [
      ...this.rootElement.querySelectorAll<HTMLElement>("button:not(.settings-tab), input"),
    ].filter((settingControl) => settingControl.closest("[hidden]") === null);
    switch (remoteAction) {
      case "left":
        this.moveSettingsTab(-1);
        return true;
      case "right":
        this.moveSettingsTab(1);
        return true;
      case "up":
        moveFocusAmong(settingControls, -1);
        return true;
      case "down":
        moveFocusAmong(settingControls, 1);
        return true;
      case "select":
        return clickFocusedElement();
      case "back":
      case "settings":
        this.app.closeTopView();
        return true;
      default:
        return false;
    }
  }

  // TODO: Validate
  private renderSettings(): void {
    const preferences = this.app.preferences;
    writeSwitchSettingRow(
      this.afterVideoEndsButton,
      "Play the next video automatically (when off, the guide opens when a video ends)",
      preferences.afterVideoEnds === "PLAY_NEXT_VIDEO",
    );
    writeSwitchSettingRow(this.upNextInformationButton, "Up next information", preferences.showsUpNextInformation);
    writeNumberInputValue(this.nextEpisodeCountdownInput, preferences.nextEpisodeCountdownSeconds);
    writeSwitchSettingRow(
      this.playerPageOverlayButton,
      "Debug details and controls over the video when the mouse moves",
      preferences.showsPlayerPageOverlay,
    );
    writeSwitchSettingRow(
      this.markStartedVideosWatchedButton,
      "Mark started videos as watching",
      preferences.marksStartedVideosWatched,
    );
    writeSwitchSettingRow(
      this.markFinishedVideosCompletedButton,
      "Mark finished videos as completed",
      preferences.marksFinishedVideosCompleted,
    );
    writeSwitchSettingRow(this.guideSourceLogosButton, "Website logos on videos", preferences.showsGuideSourceLogos);
    writeSwitchSettingRow(
      this.guideVideosSizedByTextButton,
      "Size videos in the guide to fit their text instead of their length",
      preferences.sizesGuideVideosByText,
    );
    writeNumberInputValue(this.minimumVideoMinutesInput, preferences.minimumVideoMinutes);
    writeNumberInputValue(this.guideDetailsHeightInput, preferences.guideDetailsHeightPercent);
    writeNumberInputValue(this.zoomInput, preferences.zoomPercent);
    writeSwitchSettingRow(
      this.condensedGuideButton,
      "Condensed guide (titles only, more channels)",
      preferences.showsCondensedGuide,
    );
    for (const writeWebsiteSettingRowLabel of this.websiteSettingRowLabelWriters) writeWebsiteSettingRowLabel();
    this.accountButton.textContent = preferences.isSignedIn
      ? `Signed in as ${preferences.signedInDisplayName ?? "your account"}. Select to sign out.`
      : "Not signed in. Select to sign in.";
  }

  // TODO: Validate
  private toggleAfterVideoEnds(): void {
    const preferences = this.app.preferences;
    preferences.afterVideoEnds =
      preferences.afterVideoEnds === "PLAY_NEXT_VIDEO" ? "RETURN_TO_GUIDE" : "PLAY_NEXT_VIDEO";
    this.renderSettings();
  }

  // TODO: Validate
  private toggleUpNextInformation(): void {
    this.app.preferences.showsUpNextInformation = !this.app.preferences.showsUpNextInformation;
    if (!this.app.preferences.showsUpNextInformation) stopAnnouncement();
    this.renderSettings();
  }

  // TODO: Validate
  private togglePlayerPageOverlay(): void {
    this.app.preferences.showsPlayerPageOverlay = !this.app.preferences.showsPlayerPageOverlay;
    this.renderSettings();
  }

  // TODO: Validate
  private toggleMarkStartedVideosWatched(): void {
    this.app.preferences.marksStartedVideosWatched = !this.app.preferences.marksStartedVideosWatched;
    this.renderSettings();
  }

  // TODO: Validate
  private toggleMarkFinishedVideosCompleted(): void {
    this.app.preferences.marksFinishedVideosCompleted = !this.app.preferences.marksFinishedVideosCompleted;
    this.renderSettings();
  }

  // TODO: Validate
  private toggleGuideSourceLogos(): void {
    this.app.preferences.showsGuideSourceLogos = !this.app.preferences.showsGuideSourceLogos;
    this.renderSettings();
  }

  // TODO: Validate
  private toggleGuideVideosSizedByText(): void {
    this.app.preferences.sizesGuideVideosByText = !this.app.preferences.sizesGuideVideosByText;
    this.renderSettings();
  }

  // TODO: Validate
  private toggleCondensedGuide(): void {
    this.app.preferences.showsCondensedGuide = !this.app.preferences.showsCondensedGuide;
    this.renderSettings();
  }

  // TODO: Validate
  private editStreamingProfileName(profileStreamingSite: StreamingSite): void {
    const siteDisplayName = profileStreamingSite.pluginKey;
    const profileNameInput = textInput("Profile name, exactly as the website shows it");
    profileNameInput.value = this.app.preferences.streamingProfileName(profileStreamingSite.pluginKey);
    showDialog(this.app.remoteInput, {
      title: `${siteDisplayName} profile name`,
      message:
        `When ${siteDisplayName} asks who is watching after the guide opens it, ` +
        "this profile is picked for you. Leave the name empty to pick the profile yourself.",
      contentElements: [profileNameInput],
      buttons: [
        {
          label: "Save",
          onChosen: () =>
            this.saveStreamingProfiles([
              {
                profileStreamingSite,
                profileName: profileNameInput.value.trim(),
                profilePin: this.app.preferences.streamingProfilePin(profileStreamingSite.pluginKey),
              },
            ]),
        },
        { label: "Cancel" },
      ],
    });
  }

  // TODO: Validate
  private editStreamingProfilePin(pinStreamingSite: StreamingSite): void {
    const siteDisplayName = pinStreamingSite.pluginKey;
    const profilePinInput = this.profilePinInput(pinStreamingSite);
    showDialog(this.app.remoteInput, {
      title: `${siteDisplayName} profile PIN`,
      message:
        `When ${siteDisplayName} asks for the picked profile's PIN, this PIN is entered for you. ` +
        "Leave the PIN empty to enter it yourself.",
      contentElements: [profilePinInput],
      buttons: [
        {
          label: "Save",
          onChosen: () =>
            this.saveStreamingProfiles([
              {
                profileStreamingSite: pinStreamingSite,
                profileName: this.app.preferences.streamingProfileName(pinStreamingSite.pluginKey),
                profilePin: profilePinInput.value.trim(),
              },
            ]),
        },
        { label: "Cancel" },
      ],
    });
  }

  // TODO: Validate
  private profilePinInput(profileStreamingSite: StreamingSite): HTMLInputElement {
    const profilePinInput = textInput("PIN, if the profile has one");
    profilePinInput.inputMode = "numeric";
    profilePinInput.value = this.app.preferences.streamingProfilePin(profileStreamingSite.pluginKey);
    return profilePinInput;
  }

  // TODO: Validate
  /** Writes each site's profile name and PIN, and shows one dialog for any saves that failed. */
  private saveStreamingProfiles(
    streamingProfilesToSave: { profileStreamingSite: StreamingSite; profileName: string; profilePin: string }[],
  ): void {
    const preferences = this.app.preferences;
    if (!preferences.isSignedIn) {
      for (const { profileStreamingSite, profileName, profilePin } of streamingProfilesToSave) {
        preferences.writeStreamingProfile(profileStreamingSite.pluginKey, profileName, profilePin);
      }
      this.renderSettings();
      return;
    }
    const profileSaveFailureMessages: string[] = [];
    let unfinishedProfileSaveCount = streamingProfilesToSave.length;
    // TODO: Validate
    const finishOneProfileSave = () => {
      unfinishedProfileSaveCount -= 1;
      if (unfinishedProfileSaveCount > 0 || !this.rootElement.isConnected) return;
      this.renderSettings();
      if (profileSaveFailureMessages.length === 0) return;
      showDialog(this.app.remoteInput, {
        title: "Something went wrong",
        message: profileSaveFailureMessages.join(" "),
        buttons: [{ label: "OK" }],
      });
    };
    for (const { profileStreamingSite, profileName, profilePin } of streamingProfilesToSave) {
      this.app.accountSettings.updateAccountStreamingProfile(
        profileStreamingSite.pluginKey,
        profileName.length === 0 ? null : profileName,
        profilePin.length === 0 ? null : profilePin,
        finishOneProfileSave,
        (failureMessage) => {
          profileSaveFailureMessages.push(failureMessage);
          finishOneProfileSave();
        },
      );
    }
  }

  // TODO: Validate
  /** Returns the name that the All websites row shows: the unsaved one, or the saved one when every site shares it. */
  private allWebsitesStreamingProfileNameLabel(): string {
    const shownProfileName = this.allWebsitesUnsavedStreamingProfileName ?? this.sharedSavedStreamingProfileName();
    if (shownProfileName === null) return "Mixed";
    return shownProfileName || "None, you pick it";
  }

  // TODO: Validate
  /** Returns the PIN that the All websites row shows: the unsaved one, or the saved one when every PIN site shares it. */
  private allWebsitesStreamingProfilePinLabel(): string {
    const shownProfilePin = this.allWebsitesUnsavedStreamingProfilePin ?? this.sharedSavedStreamingProfilePin();
    if (shownProfilePin === null) return "Mixed";
    return hiddenProfilePinLabel(shownProfilePin);
  }

  // TODO: Validate
  /** Returns the profile name that every profile site has saved, or null when they differ. */
  private sharedSavedStreamingProfileName(): string | null {
    const savedProfileNames = new Set(
      this.streamingSitesWithProfileScreens.map((profileStreamingSite) =>
        this.app.preferences.streamingProfileName(profileStreamingSite.pluginKey),
      ),
    );
    const [onlySavedProfileName] = savedProfileNames;
    return savedProfileNames.size === 1 && onlySavedProfileName !== undefined ? onlySavedProfileName : null;
  }

  // TODO: Validate
  /** Returns the PIN that every site taking a PIN has saved, or null when they differ. */
  private sharedSavedStreamingProfilePin(): string | null {
    const savedProfilePins = new Set(
      this.streamingSitesWithProfilePins.map((pinStreamingSite) =>
        this.app.preferences.streamingProfilePin(pinStreamingSite.pluginKey),
      ),
    );
    const [onlySavedProfilePin] = savedProfilePins;
    return savedProfilePins.size === 1 && onlySavedProfilePin !== undefined ? onlySavedProfilePin : null;
  }

  // TODO: Validate
  /** Asks for the profile name that the All websites row's Save button writes to every profile site. */
  private editAllWebsitesStreamingProfileName(): void {
    const profileSiteNames = this.streamingSitesWithProfileScreens
      .map((profileStreamingSite) => profileStreamingSite.pluginKey)
      .join(", ");
    const profileNameInput = textInput("Profile name, exactly as the websites show it");
    profileNameInput.value =
      this.allWebsitesUnsavedStreamingProfileName ?? this.sharedSavedStreamingProfileName() ?? "";
    showDialog(this.app.remoteInput, {
      title: "Profile name on every website",
      message:
        `When ${profileSiteNames} asks who is watching after the guide opens it, this profile is picked for you. ` +
        "Leave the name empty to pick the profile each website highlights, usually the last one used. Nothing is " +
        "saved until you choose Save next to the profile name.",
      contentElements: [profileNameInput],
      buttons: [
        {
          label: "Done",
          onChosen: () => {
            this.allWebsitesUnsavedStreamingProfileName = profileNameInput.value.trim();
            this.renderSettings();
          },
        },
        { label: "Cancel" },
      ],
    });
  }

  // TODO: Validate
  /** Asks for the PIN that the All websites row's Save button writes to every site that takes a PIN. */
  private editAllWebsitesStreamingProfilePin(): void {
    const pinSiteNames = this.streamingSitesWithProfilePins
      .map((pinStreamingSite) => pinStreamingSite.pluginKey)
      .join(", ");
    const profilePinInput = textInput("PIN, if the profile has one");
    profilePinInput.inputMode = "numeric";
    profilePinInput.value = this.allWebsitesUnsavedStreamingProfilePin ?? this.sharedSavedStreamingProfilePin() ?? "";
    showDialog(this.app.remoteInput, {
      title: "Profile PIN on every website",
      message:
        `When ${pinSiteNames} asks for the picked profile's PIN, this PIN is entered for you. Leave the PIN empty ` +
        "to enter it yourself. Nothing is saved until you choose Save next to the profile PIN.",
      contentElements: [profilePinInput],
      buttons: [
        {
          label: "Done",
          onChosen: () => {
            this.allWebsitesUnsavedStreamingProfilePin = profilePinInput.value.trim();
            this.renderSettings();
          },
        },
        { label: "Cancel" },
      ],
    });
  }

  // TODO: Validate
  private showDebugInformation(): void {
    const debugInformationPages = this.debugInformationPages();
    let shownDebugInformationPageIndex = 0;
    const debugInformationPageText = textLabel("", "debug-information-page");
    const debugInformationDialog = showDialog(this.app.remoteInput, {
      title: "Debug information",
      contentElements: [debugInformationPageText],
      buttons: [
        {
          label: "Previous page",
          closesDialog: false,
          onChosen: () => showDebugInformationPage(shownDebugInformationPageIndex - 1),
        },
        {
          label: "Next page",
          closesDialog: false,
          onChosen: () => showDebugInformationPage(shownDebugInformationPageIndex + 1),
        },
        { label: "Close" },
      ],
    });
    const [previousPageButton, nextPageButton] = debugInformationDialog.buttonElements;

    // TODO: Validate
    function showDebugInformationPage(debugInformationPageIndex: number): void {
      shownDebugInformationPageIndex = debugInformationPageIndex;
      debugInformationDialog.setTitle(
        `Debug information, page ${debugInformationPageIndex + 1} of ${debugInformationPages.length}`,
      );
      debugInformationPageText.textContent = debugInformationPages[debugInformationPageIndex] ?? "";
      if (previousPageButton === undefined || nextPageButton === undefined) return;
      previousPageButton.disabled = debugInformationPageIndex <= 0;
      nextPageButton.disabled = debugInformationPageIndex >= debugInformationPages.length - 1;
      if (nextPageButton.disabled && document.activeElement === nextPageButton) previousPageButton.focus();
      if (previousPageButton.disabled && document.activeElement === previousPageButton) nextPageButton.focus();
    }

    showDebugInformationPage(0);
    nextPageButton?.focus();
  }

  // TODO: Validate
  private debugInformationPages(): string[] {
    const browserAndUserscriptPage = [
      `Userscript: ${GM_info.script.name} ${GM_info.script.version}`,
      `Userscript manager: ${GM_info.scriptHandler} ${GM_info.version}`,
      `Browser: ${navigator.userAgent}`,
      `Platform: ${navigator.platform}`,
      `Screen: ${window.screen.width}x${window.screen.height}, device pixel ratio ${window.devicePixelRatio}`,
      "",
      `Speech for Up next: ${"speechSynthesis" in window ? "available" : "not available"}`,
      `Media autoplay: ${mediaAutoplayPolicy()}`,
      `Full screen: ${document.fullscreenElement !== null || window.matchMedia("(display-mode: fullscreen)").matches}`,
    ].join("\n");
    const streamingSiteLines = ALL_STREAMING_SITES.map((streamingSite) => {
      const pageAutomation = [
        streamingSite.profileButtons === undefined ? null : "profiles",
        streamingSite.pinEntry === undefined ? null : "PIN",
        streamingSite.createAdMarker === undefined ? null : "ads",
      ].filter((automationPart) => automationPart !== null);
      return (
        `${streamingSite.pluginKey} (${streamingSite.domains.join(", ")}): ` +
        `page automation: ${pageAutomation.length === 0 ? "none" : pageAutomation.join(", ")}`
      );
    });
    return [browserAndUserscriptPage, ["Streaming websites:", ...streamingSiteLines].join("\n")];
  }
}

// TODO: Validate
function settingButton(onClick: () => void): HTMLButtonElement {
  return actionButton("", onClick, "setting-button");
}

// TODO: Validate
function autoplayCheckLabel(autoplayCheck: AutoplayCheck | null): string {
  if (autoplayCheck === null) return "Not checked yet. Select to open it once so it can be checked.";
  const checkedAtText = new Date(autoplayCheck.checkedAt).toLocaleString();
  switch (autoplayCheck.autoplayPermission) {
    case "ALLOWED":
      return `Starts with sound (checked ${checkedAtText})`;
    case "MUTED_ONLY":
      return `Starts only without sound. Select to open it and allow Sound (checked ${checkedAtText})`;
    case "BLOCKED":
      return `Blocked. Select to open it and allow Sound (checked ${checkedAtText})`;
  }
}

// TODO: Validate
function streamingSiteSupportsAnyToggle(streamingSite: StreamingSite): boolean {
  return STREAMING_SITE_TOGGLE_SETTINGS.some((toggleSetting) => toggleSetting.isSupportedBy(streamingSite));
}

// TODO: Validate
function settingsTabPanel(): HTMLDivElement {
  const createdSettingsTabPanel = document.createElement("div");
  createdSettingsTabPanel.className = "settings-tab-panel";
  return createdSettingsTabPanel;
}

// TODO: Validate
function sectionHeading(headingText: string): HTMLDivElement {
  return textLabel(headingText, "settings-section-heading");
}

// TODO: Validate
function streamingProfileWarning(): HTMLDivElement {
  const streamingProfileWarningElement = textLabel(STREAMING_PROFILE_WARNING_REST, "settings-note");
  const redWarningSentences = document.createElement("span");
  redWarningSentences.className = "settings-red-warning";
  redWarningSentences.textContent = STREAMING_PROFILE_WARNING_RED_SENTENCES;
  streamingProfileWarningElement.prepend(redWarningSentences);
  return streamingProfileWarningElement;
}

// TODO: Validate
/** Returns a setting row's PIN text, which says whether a PIN is set without showing its digits. */
function hiddenProfilePinLabel(profilePin: string): string {
  return profilePin.length === 0 ? "None, you enter it" : "Set, hidden";
}

// TODO: Validate
function settingRowLabel(labelText: string): HTMLSpanElement {
  const settingLabel = document.createElement("span");
  settingLabel.className = "setting-row-label";
  settingLabel.textContent = labelText;
  return settingLabel;
}

// TODO: Validate
/** Fills settingButton with labelText and a sliding switch, and returns the label so the caller can add to it. */
function writeSwitchSettingRow(
  settingButton: HTMLButtonElement,
  labelText: string,
  switchState: SwitchState,
): HTMLSpanElement {
  settingButton.setAttribute("role", "switch");
  settingButton.setAttribute("aria-checked", switchState === true ? "true" : "false");
  const settingLabel = settingRowLabel(labelText);
  const settingSwitch = document.createElement("span");
  settingSwitch.className = "setting-switch";
  settingSwitch.classList.toggle("is-on", switchState === true);
  // A switch for several websites that differ sits in the middle.
  settingSwitch.classList.toggle("is-mixed", switchState === "MIXED");
  settingButton.replaceChildren(settingLabel, settingSwitch);
  return settingLabel;
}

// TODO: Validate
/** Fills settingButton with labelText and valueText in a box. Choosing the row opens an editor or runs an action. */
function writeValueSettingRow(settingButton: HTMLButtonElement, labelText: string, valueText: string): HTMLSpanElement {
  const settingLabel = settingRowLabel(labelText);
  const settingValue = document.createElement("span");
  settingValue.className = "setting-value";
  settingValue.textContent = valueText;
  settingButton.replaceChildren(settingLabel, settingValue);
  return settingLabel;
}

// TODO: Validate
/**
 * Returns a number input that saves its entry when it changes, after the viewer presses Enter or leaves it. The entry
 * is kept between minimumValue and maximumValue, and an empty or unreadable entry saves defaultValue.
 */
function numberSettingInput(
  minimumValue: number,
  maximumValue: number,
  defaultValue: number,
  saveEnteredValue: (enteredValue: number) => void,
): HTMLInputElement {
  const numberInput = textInput(String(defaultValue), "number");
  numberInput.classList.add("setting-number-input");
  numberInput.min = String(minimumValue);
  numberInput.max = String(maximumValue);
  numberInput.addEventListener("change", () => {
    const enteredValue = Number.parseInt(numberInput.value.trim(), 10);
    const savedValue = Number.isNaN(enteredValue)
      ? defaultValue
      : Math.min(maximumValue, Math.max(minimumValue, enteredValue));
    numberInput.value = String(savedValue);
    saveEnteredValue(savedValue);
  });
  return numberInput;
}

// TODO: Validate
function writeNumberInputValue(numberInput: HTMLInputElement, savedValue: number): void {
  // Rewriting the value while the viewer types in it would move the cursor, so the focused input is left alone.
  if (document.activeElement !== numberInput) numberInput.value = String(savedValue);
}

// TODO: Validate
function numberSettingRow(labelText: string, numberInput: HTMLInputElement): HTMLLabelElement {
  const numberSettingRowElement = document.createElement("label");
  numberSettingRowElement.className = "setting-number-row";
  numberSettingRowElement.append(settingRowLabel(labelText), numberInput);
  return numberSettingRowElement;
}

// TODO: Validate
function upNextSpeechNote(): string {
  return "speechSynthesis" in window
    ? "Up next is read aloud with the browser's speech."
    : "This browser can't read Up next aloud, so Up next waits 5 seconds before the next video plays.";
}

// TODO: Validate
/**
 * Returns the guide page's autoplay policy for media elements. Only some browsers have getAutoplayPolicy().
 */
function mediaAutoplayPolicy(): string {
  const navigatorWithAutoplayPolicy = navigator as Navigator & {
    getAutoplayPolicy?: (mediaType: "mediaelement") => string;
  };
  return navigatorWithAutoplayPolicy.getAutoplayPolicy?.("mediaelement") ?? "unknown in this browser";
}

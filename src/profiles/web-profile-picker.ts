// TODO: Validate

import type { StatusMessageOverlay } from "../screenautomation/status-message-overlay";
import type { StreamingSite } from "../streamingsites/streaming-site";
import type { ProfilePickerProgress, ProfilePickerSetup } from "./profile-picker";
import type { PinEntry, ProfileButton } from "./streaming-profile-screen";

const DELAY_BETWEEN_PIN_KEYS = 250;

// TODO: Validate
export class WebProfilePicker {
  private readonly pageSite: StreamingSite;
  private readonly profilePickerSetup: ProfilePickerSetup;
  private readonly siteDisplayName: string;
  private readonly pickerOverlay: StatusMessageOverlay;
  private readonly reportProgress: (profilePickerProgress: ProfilePickerProgress) => void;
  private pageCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private detectsScreensAndPlayback = false;
  private isWaitingMessageShown = false;
  private isPinEntryScheduled = false;
  private hasEnteredPin = false;
  private isDisarmed = false;
  /** The step the picker is on, shown in the status overlay, such as "Profile screen detected". */
  private currentStep = "Waiting for the profile screen";

  // TODO: Validate
  constructor(
    pageSite: StreamingSite,
    profilePickerSetup: ProfilePickerSetup,
    siteDisplayName: string,
    pickerOverlay: StatusMessageOverlay,
    reportProgress: (profilePickerProgress: ProfilePickerProgress) => void,
  ) {
    this.pageSite = pageSite;
    this.profilePickerSetup = { ...profilePickerSetup };
    this.siteDisplayName = siteDisplayName;
    this.pickerOverlay = pickerOverlay;
    this.reportProgress = reportProgress;
  }

  // TODO: Validate
  start(): void {
    if (!this.isArmed()) {
      this.disarm();
      return;
    }
    this.showWaitingMessage();
    this.pageCheckIntervalId = setInterval(() => this.checkPage(), 500);
  }

  // TODO: Validate
  /** Called when the page's video starts playing. A playing video means the profile screens are passed, so the picker stops. */
  onVideoStartedPlaying(): void {
    if (!this.isArmed()) return;
    console.info(`${this.siteDisplayName} started playing`);
    if (this.isWaitingMessageShown) this.pickerOverlay.show("Video playback detected", 4_000);
    this.isWaitingMessageShown = false;
    this.disarm();
  }

  // TODO: Validate
  cancelOnBackPress(): boolean {
    return this.cancelWaiting();
  }

  // TODO: Validate
  /** Disarms the picker if its waiting message is shown and it is still armed. Returns whether it disarmed. */
  private cancelWaiting(): boolean {
    if (!this.isWaitingMessageShown || !this.isArmed()) return false;
    console.info(`The viewer cancelled waiting for ${this.siteDisplayName}`);
    this.pickerOverlay.hide();
    this.isWaitingMessageShown = false;
    this.disarm();
    return true;
  }

  // TODO: Validate
  private isArmed(): boolean {
    return !this.isDisarmed && Date.now() < this.profilePickerSetup.armedUntil;
  }

  // TODO: Validate
  private disarm(): void {
    if (this.isDisarmed) return;
    this.isDisarmed = true;
    this.detectsScreensAndPlayback = false;
    if (this.pageCheckIntervalId !== null) clearInterval(this.pageCheckIntervalId);
    this.pageCheckIntervalId = null;
    this.reportProgress("disarmed");
  }

  // TODO: Validate
  private showWaitingMessage(): void {
    this.detectsScreensAndPlayback = true;
    this.isWaitingMessageShown = true;
    const timeUntilArmedWindowEnds = Math.max(0, this.profilePickerSetup.armedUntil - Date.now());
    this.pickerOverlay.show(this.stepMessage(), timeUntilArmedWindowEnds, () => this.cancelWaiting());
  }

  // TODO: Validate
  /**
   * Records `step` as the current step and logs it. If the waiting message is shown, the overlay changes to the new
   * step right away.
   */
  private showStep(step: string): void {
    this.currentStep = step;
    console.info(`${this.siteDisplayName}: ${step}`);
    if (this.isWaitingMessageShown && this.isArmed()) this.pickerOverlay.updateMessageIfShown(this.stepMessage());
  }

  // TODO: Validate
  /** Returns the overlay text, such as "YouTube: Profile screen detected… Press Back to cancel." */
  private stepMessage(): string {
    return `${this.siteDisplayName}: ${this.currentStep}… ${this.pickerOverlay.cancelInstructionForThisDevice}`;
  }

  // TODO: Validate
  private pauseDetectionThenResume(): void {
    this.detectsScreensAndPlayback = false;
    setTimeout(() => {
      if (this.detectsScreensAndPlayback || !this.isArmed()) return;
      this.showWaitingMessage();
    }, 2_000);
  }

  // TODO: Validate
  private checkPage(): void {
    if (!this.isArmed()) {
      if (this.pageCheckIntervalId !== null) clearInterval(this.pageCheckIntervalId);
      this.pageCheckIntervalId = null;
      this.isWaitingMessageShown = false;
      return;
    }
    if (!this.detectsScreensAndPlayback) return;
    if (this.reopenVideoIfSentAway()) return;
    const profilePin = this.profilePickerSetup.profilePin;
    if (!this.profilePickerSetup.hasPickedProfile && this.clickWantedProfile()) {
      this.profilePickerSetup.hasPickedProfile = true;
      this.reportProgress("profile-picked");
      const waitsForPinScreen = profilePin.length > 0 && this.pageSite.pinEntry !== undefined;
      this.showStep(waitsForPinScreen ? "Profile picked. Waiting for the PIN screen" : "Profile picked");
      this.pauseDetectionThenResume();
      return;
    }
    // The PIN is entered again while its screen still shows, because some websites miss digits typed too early. A
    // website can also skip its profile screen and go straight to the PIN screen.
    if (profilePin.length > 0 && this.findPinEntry() !== null) {
      if (!this.isPinEntryScheduled) this.showStep("PIN screen detected");
      this.enterPinOnceSettled(profilePin);
    }
  }

  // TODO: Validate
  /**
   * Opens the video's address again when the picker picked a profile or entered the PIN, and the site then sent the
   * page to its pathAfterProfileScreen instead of the video. Returns whether it did. The picker disarms first, so a
   * site that keeps sending the page away is not reopened over and over.
   */
  private reopenVideoIfSentAway(): boolean {
    const pathAfterProfileScreen = this.pageSite.pathAfterProfileScreen;
    const videoUrl = this.profilePickerSetup.videoUrl;
    if (pathAfterProfileScreen === undefined || videoUrl === null) return false;
    if (!this.profilePickerSetup.hasPickedProfile && !this.hasEnteredPin) return false;
    if (window.location.pathname !== pathAfterProfileScreen) return false;
    this.showStep("Reopening the video");
    this.disarm();
    window.location.assign(videoUrl);
    return true;
  }

  // TODO: Validate
  private wantedProfileButton(profileButtons: ProfileButton[]): ProfileButton | null {
    // Without a saved name the viewer picks the profile, because a website's profile screen highlights none.
    const wantedProfileName = this.profilePickerSetup.wantedProfileName.trim().toLowerCase();
    if (wantedProfileName.length === 0) return null;
    return (
      profileButtons.find((profileButton) => profileButton.name.trim().toLowerCase() === wantedProfileName) ?? null
    );
  }

  // TODO: Validate
  private clickWantedProfile(): boolean {
    const profileButtons = this.pageSite.profileButtons?.() ?? [];
    if (profileButtons.length === 0) return false;
    const wantedProfileButton = this.wantedProfileButton(profileButtons);
    if (wantedProfileButton === null) return false;
    this.showStep(`Profile screen detected. Picking ${wantedProfileButton.name}`);
    wantedProfileButton.button.click();
    return true;
  }

  // TODO: Validate
  private findPinEntry(): PinEntry | null {
    return this.pageSite.pinEntry?.() ?? null;
  }

  // TODO: Validate
  private enterPinOnceSettled(profilePin: string): void {
    if (this.isPinEntryScheduled) return;
    this.isPinEntryScheduled = true;
    setTimeout(() => {
      this.isPinEntryScheduled = false;
      if (!this.detectsScreensAndPlayback) return;
      const settledPinEntry = this.findPinEntry();
      if (settledPinEntry === null) return;
      if (!canEnterPin(settledPinEntry, profilePin)) {
        console.warn(`The ${this.siteDisplayName} PIN screen cannot type the saved PIN`);
        return;
      }
      this.showStep("Entering the PIN");
      enterPin(settledPinEntry, profilePin, () => this.isArmed());
      this.hasEnteredPin = true;
      this.pauseDetectionThenResume();
    }, 1_000);
  }
}

// TODO: Validate
/** Returns whether `pinEntry` has every key or field needed to type `profilePin`. */
function canEnterPin(pinEntry: PinEntry, profilePin: string): boolean {
  if (pinEntry.kind === "pinDigitInputs") return pinEntry.pinDigitInputs.length >= profilePin.length;
  return true;
}

// TODO: Validate
function enterPin(pinEntry: PinEntry, profilePin: string, isStillWanted: () => boolean): void {
  [...profilePin].forEach((pinDigit, digitIndex) => {
    setTimeout(() => {
      if (!isStillWanted()) return;
      if (pinEntry.kind === "pinDigitInputs") {
        const pinDigitInput = pinEntry.pinDigitInputs[digitIndex];
        if (pinDigitInput) typeIntoInput(pinDigitInput, pinDigit);
      } else {
        typeIntoInput(pinEntry.pinInput, pinEntry.pinInput.value + pinDigit);
      }
    }, digitIndex * DELAY_BETWEEN_PIN_KEYS);
  });
}

// TODO: Validate
function typeIntoInput(pinInput: HTMLInputElement, typedValue: string): void {
  const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  pinInput.focus();
  nativeValueSetter?.call(pinInput, typedValue);
  pinInput.dispatchEvent(new Event("input", { bubbles: true }));
  pinInput.dispatchEvent(new Event("change", { bubbles: true }));
}

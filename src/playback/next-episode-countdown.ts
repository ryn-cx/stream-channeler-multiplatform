// TODO: Validate
import type { StatusMessageOverlay } from "../screenautomation/status-message-overlay";

// TODO: Validate
export class NextEpisodeCountdown {
  private readonly countdownOverlay: StatusMessageOverlay;
  private countdownEndsAt = 0;
  private onCountdownFinished: (() => void) | null = null;
  private onCountdownCancelled: (() => void) | null = null;
  private secondsLeftTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // TODO: Validate
  constructor(countdownOverlay: StatusMessageOverlay) {
    this.countdownOverlay = countdownOverlay;
  }

  // TODO: Validate
  start(countdownSeconds: number, onCountdownFinished: () => void, onCountdownCancelled: () => void): void {
    this.stopCountingDown();
    this.onCountdownFinished = onCountdownFinished;
    this.onCountdownCancelled = onCountdownCancelled;
    const countdown = countdownSeconds * 1_000;
    this.countdownEndsAt = performance.now() + countdown;
    this.countdownOverlay.show(countdownMessage(countdownSeconds), countdown + 1_000, () => {
      this.cancelOnBackPress();
    });
    this.showSecondsLeftOrFinish();
  }

  // TODO: Validate
  cancelSilently(): void {
    if (this.onCountdownFinished === null) return;
    this.stopCountingDown();
    this.countdownOverlay.hide();
  }

  // TODO: Validate
  finishNow(): void {
    const finishedCallback = this.onCountdownFinished;
    if (finishedCallback === null) return;
    this.stopCountingDown();
    this.countdownOverlay.hide();
    finishedCallback();
  }

  // TODO: Validate
  cancelOnBackPress(): boolean {
    const cancelledCallback = this.onCountdownCancelled;
    if (cancelledCallback === null) return false;
    this.stopCountingDown();
    this.countdownOverlay.show("Next episode cancelled", 3_000);
    cancelledCallback();
    return true;
  }

  // TODO: Validate
  private showSecondsLeftOrFinish(): void {
    const timeLeftInCountdown = this.countdownEndsAt - performance.now();
    if (timeLeftInCountdown <= 0) {
      this.finishNow();
      return;
    }
    const secondsLeftInCountdown = Math.ceil(timeLeftInCountdown / 1_000);
    this.countdownOverlay.updateMessageIfShown(countdownMessage(secondsLeftInCountdown));
    this.secondsLeftTimeoutId = setTimeout(
      () => this.showSecondsLeftOrFinish(),
      timeLeftInCountdown - (secondsLeftInCountdown - 1) * 1_000,
    );
  }

  // TODO: Validate
  private stopCountingDown(): void {
    if (this.secondsLeftTimeoutId !== null) clearTimeout(this.secondsLeftTimeoutId);
    this.secondsLeftTimeoutId = null;
    this.onCountdownFinished = null;
    this.onCountdownCancelled = null;
  }
}

// TODO: Validate
function countdownMessage(secondsLeftInCountdown: number): string {
  const secondsLabel = secondsLeftInCountdown === 1 ? "1 second" : `${secondsLeftInCountdown} seconds`;
  return `Playing the next episode in ${secondsLabel}. Press Back to cancel.`;
}

// TODO: Validate

// TODO: Validate
/**
 * Clicks one of a site's skip buttons, such as Skip Intro or Skip Credits, when it shows. The player page calls
 * clickWhenShowing on every media tick, so the same button is only clicked again after a delay. That stops one button
 * from getting a click every second.
 */
export class SkipButtonClicker {
  private readonly findSkipButton: () => HTMLElement | null;
  private lastClickedSkipButton: HTMLElement | null = null;
  private lastSkipButtonClickAt = 0;

  // TODO: Validate
  constructor(findSkipButton: () => HTMLElement | null) {
    this.findSkipButton = findSkipButton;
  }

  // TODO: Validate
  /** Clicks the skip button if it is showing. Returns whether it clicked. */
  clickWhenShowing(now: number): boolean {
    const showingSkipButton = this.findSkipButton();
    if (showingSkipButton === null) return false;
    // A click that the site ignored is tried again after this long, as long as the button is still there.
    const isRepeatClickTooSoon =
      showingSkipButton === this.lastClickedSkipButton && now - this.lastSkipButtonClickAt < 5_000;
    if (isRepeatClickTooSoon) return false;
    this.lastClickedSkipButton = showingSkipButton;
    this.lastSkipButtonClickAt = now;
    showingSkipButton.click();
    return true;
  }
}

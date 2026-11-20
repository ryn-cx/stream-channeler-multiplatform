// TODO: Validate
import { describe, expect, it } from "vitest";
import { SkipButtonClicker } from "../../src/playback/skip-button-clicker";

// TODO: Validate
function fakeSkipButton(): { button: HTMLElement; clickCount: () => number } {
  let skipButtonClickCount = 0;
  const button = {
    click: () => {
      skipButtonClickCount += 1;
    },
  } as unknown as HTMLElement;
  return { button, clickCount: () => skipButtonClickCount };
}

describe("SkipButtonClicker", () => {
  it("does not click while no skip button is showing", () => {
    const skipButtonClicker = new SkipButtonClicker(() => null);
    expect(skipButtonClicker.clickWhenShowing(1_000)).toBe(false);
  });

  it("clicks a showing button once, and again only after the retry delay", () => {
    const showingFakeButton = fakeSkipButton();
    const skipButtonClicker = new SkipButtonClicker(() => showingFakeButton.button);
    expect(skipButtonClicker.clickWhenShowing(1_000)).toBe(true);
    expect(skipButtonClicker.clickWhenShowing(2_000)).toBe(false);
    expect(skipButtonClicker.clickWhenShowing(5_999)).toBe(false);
    expect(skipButtonClicker.clickWhenShowing(6_000)).toBe(true);
    expect(showingFakeButton.clickCount()).toBe(2);
  });

  it("clicks a new button right away", () => {
    const firstFakeButton = fakeSkipButton();
    const secondFakeButton = fakeSkipButton();
    let showingFakeButton = firstFakeButton.button;
    const skipButtonClicker = new SkipButtonClicker(() => showingFakeButton);
    skipButtonClicker.clickWhenShowing(1_000);
    showingFakeButton = secondFakeButton.button;
    expect(skipButtonClicker.clickWhenShowing(2_000)).toBe(true);
    expect(secondFakeButton.clickCount()).toBe(1);
  });
});

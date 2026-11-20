export interface ProfileButton {
  name: string;
  button: HTMLElement;
}

/**
 * Returns each profile button when the names are inside of the profile button.
 * button.
 */
export function findProfileButtonsInside(profileButtonSelector: string, profileNameSelector: string): ProfileButton[] {
  const profileButtonElements = document.querySelectorAll<HTMLElement>(profileButtonSelector);
  return [...profileButtonElements].map((profileButtonElement) => {
    const profileName = profileButtonElement.querySelector(profileNameSelector)?.textContent?.trim();

    // Should be impossible unless the page's HTML changes.
    if (!profileName) {
      throw new Error(`A profile button matching ${profileButtonSelector} has no ${profileNameSelector}.`);
    }

    return { name: profileName, button: profileButtonElement };
  });
}

/**
 * Returns each profile button when the names are next to the profile button.
 */
export function findProfileButtonsNextTo(profileButtonSelector: string, profileNameSelector: string): ProfileButton[] {
  const profileButtonElements = document.querySelectorAll<HTMLElement>(profileButtonSelector);
  return [...profileButtonElements].map((profileButtonElement) => {
    const profileName = profileButtonElement.parentElement?.querySelector(profileNameSelector)?.textContent?.trim();

    // Should be impossible unless the page's HTML changes.
    if (!profileName) {
      throw new Error(
        `The parent of a profile button matching ${profileButtonSelector} has no ${profileNameSelector}.`,
      );
    }

    return { name: profileName, button: profileButtonElement };
  });
}

/**
 * Returns the pinDigitInputs style pin input.
 */
export function findPinDigitInputs(pinDigitInputSelector: string): PinEntry | null {
  const pinDigitInputs = [...document.querySelectorAll<HTMLInputElement>(pinDigitInputSelector)];

  // Return null when on a page that is not the pin input screen.
  if (pinDigitInputs.length === 0) return null;

  return { kind: "pinDigitInputs", pinDigitInputs };
}

// TODO: Validate
/**
 * Returns the single field that matches pinInputSelector and takes the whole PIN, or null when the page is not a PIN
 * screen.
 */
export function findPinInput(pinInputSelector: string): PinEntry | null {
  const pinInput = document.querySelector<HTMLInputElement>(pinInputSelector);
  if (pinInput === null) return null;
  return { kind: "pinInput", pinInput };
}

export type PinEntry =
  // Multiple digits in a single field.
  | { kind: "pinInput"; pinInput: HTMLInputElement }
  // Multiple fields and one digit per field.
  | { kind: "pinDigitInputs"; pinDigitInputs: HTMLInputElement[] };

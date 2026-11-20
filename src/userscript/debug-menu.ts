// TODO: Validate
import type { StoredValueKey } from "../data/local-app-storage";
import { readGmValue, writeGmValue } from "./gm-values";

const ALWAYS_SHOWS_PLAYER_PAGE_OVERLAY_KEY: StoredValueKey = "alwaysShowsPlayerPageOverlay";

// TODO: Validate
/**
 * Adds a switch to the userscript manager's menu that keeps the player page's debug overlay on screen. The menu item
 * names its current state, so it is registered again with the new name each time it is switched.
 */
export async function registerAlwaysShowOverlayMenuCommand(): Promise<void> {
  let alwaysShowsPlayerPageOverlay = (await readGmValue<boolean>(ALWAYS_SHOWS_PLAYER_PAGE_OVERLAY_KEY)) === true;
  let alwaysShowOverlayMenuCommandId: number | null = null;

  // TODO: Validate
  const registerWithCurrentState = (): void => {
    if (alwaysShowOverlayMenuCommandId !== null) GM_unregisterMenuCommand(alwaysShowOverlayMenuCommandId);
    alwaysShowOverlayMenuCommandId = GM_registerMenuCommand(
      `Debug: always show the player overlay (${alwaysShowsPlayerPageOverlay ? "On" : "Off"})`,
      () => {
        alwaysShowsPlayerPageOverlay = !alwaysShowsPlayerPageOverlay;
        void writeGmValue(ALWAYS_SHOWS_PLAYER_PAGE_OVERLAY_KEY, alwaysShowsPlayerPageOverlay);
        registerWithCurrentState();
      },
    );
  };

  registerWithCurrentState();
}

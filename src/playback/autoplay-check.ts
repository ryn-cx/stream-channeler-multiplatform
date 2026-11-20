// TODO: Validate
import { LocalAppStorage } from "../data/local-app-storage";
import type { StreamingSite } from "../streamingsites/streaming-site";

export type AutoplayPermission = "ALLOWED" | "MUTED_ONLY" | "BLOCKED";

export interface AutoplayCheck {
  autoplayPermission: AutoplayPermission;
  checkedAt: number;
}

// TODO: Validate
/**
 * Records whether pageSite may start media with sound without a click. The settings list the result for each site, so
 * the viewer knows which sites still need sound allowed in the browser.
 */
export async function recordAutoplayPermission(pageSite: StreamingSite): Promise<void> {
  // The permission is read before the settings load, so that a click during the load cannot change the result.
  const autoplayPermission = currentAutoplayPermission();
  if (autoplayPermission === null) return;
  const preferences = await LocalAppStorage.load();
  preferences.writeAutoplayCheck(pageSite.pluginKey, { autoplayPermission, checkedAt: Date.now() });
}

// TODO: Validate
/** Returns this page's autoplay permission, or null when it cannot be told reliably. */
function currentAutoplayPermission(): AutoplayPermission | null {
  // Only some browsers, such as Firefox, have getAutoplayPolicy().
  const navigatorWithAutoplayPolicy = navigator as Navigator & {
    getAutoplayPolicy?: (mediaType: "mediaelement") => string;
  };
  const mediaAutoplayPolicy = navigatorWithAutoplayPolicy.getAutoplayPolicy?.("mediaelement");
  if (mediaAutoplayPolicy === "allowed") return "ALLOWED";
  if (mediaAutoplayPolicy === "allowed-muted") return "MUTED_ONLY";
  if (mediaAutoplayPolicy === "disallowed") return "BLOCKED";
  // Other browsers start a new AudioContext suspended when sound may not play without a click. A click on the page
  // lets sound play anyway, so the check is skipped once the viewer has clicked or pressed a key on the page.
  if (navigator.userActivation?.hasBeenActive) return null;
  const autoplayProbeAudioContext = new AudioContext();
  const isSoundAllowed = autoplayProbeAudioContext.state === "running";
  void autoplayProbeAudioContext.close();
  return isSoundAllowed ? "ALLOWED" : "BLOCKED";
}

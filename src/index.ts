// TODO: Validate

import { startPlayerPage } from "./screenautomation/player-page";
import { streamingSiteForHost } from "./streamingsites/streaming-site";
import { startGuidePage } from "./ui/guide/guide-page";
import { registerAlwaysShowOverlayMenuCommand } from "./userscript/debug-menu";
import { GUIDE_PAGE_URL, isGuidePage, isStreamChannelerWebsitePage } from "./userscript/userscript-pages";
import { startWebsiteHeaderOpenAppLink } from "./userscript/website-header-open-app-link";

// TODO: Validate
function whenDocumentIsReady(startPage: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPage, { once: true });
    return;
  }
  startPage();
}

// TODO: Validate
function startUserscript(): void {
  const isTopFrame = window.top === window;
  if (isTopFrame) {
    GM_registerMenuCommand("Open the Stream Channeler guide", () => window.location.assign(GUIDE_PAGE_URL));
    void registerAlwaysShowOverlayMenuCommand();
  }
  const pageUrl = new URL(window.location.href);
  if (isTopFrame && isGuidePage(pageUrl)) {
    void startGuidePage();
  } else if (isTopFrame && isStreamChannelerWebsitePage(pageUrl)) {
    whenDocumentIsReady(startWebsiteHeaderOpenAppLink);
  } else if (streamingSiteForHost(pageUrl.hostname) !== null) {
    whenDocumentIsReady(startPlayerPage);
  }
}

startUserscript();

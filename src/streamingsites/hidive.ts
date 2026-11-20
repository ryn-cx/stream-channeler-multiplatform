import { BrowserMediaEndedEndsVideo } from "../playback/endrules/browser-media-ended-ends-video";
import { findProfileButtonsNextTo } from "../profiles/streaming-profile-screen";
import type { StreamingSite } from "./streaming-site";

export const hidiveSite: StreamingSite = {
  pluginKey: "HIDIVE",
  domains: ["hidive.com"],
  faviconUrl:
    "https://static.diceplatform.com/prod/original/dce.hidive/settings/HIDIVE_Logo_iOS_1024x1024_281_29.Y3YMf.vMQ59.png",
  playbackEndDetection: () => new BrowserMediaEndedEndsVideo(),
  profileButtons: () =>
    findProfileButtonsNextTo('#dice-modal [role="listitem"] button[aria-label^="Select Profile: "]', "p"),
};

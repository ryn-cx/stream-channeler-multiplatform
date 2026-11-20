// TODO: Validate
import { EpisodeAddressChangeEndsVideo } from "../playback/endrules/episode-address-change-ends-video";
import { findVisibleElements } from "../screenautomation/visible-elements";
import type { StreamingSite } from "./streaming-site";

// TODO: Validate
export const rokuChannelSite: StreamingSite = {
  pluginKey: "The Roku Channel",
  domains: ["therokuchannel.roku.com", "roku.com"],
  faviconUrl: "https://therokuchannel.roku.com/favicon.ico",
  // The Roku Channel changes /watch/<id> to the next episode the moment the episode ends. Ads are played by a separate ad
  // player, so the address is the signal that only the episode's end gives.
  playbackEndDetection: () => new EpisodeAddressChangeEndsVideo(/^\/watch\/([0-9a-f]+)/),
  skipIntroButton: { find: () => findBottomBarButton("skip introduction") },
  nextEpisodeButton: { find: () => findBottomBarButton("watch next") },
};

// The player's buttons have no test ids or labels, so they are told apart by their text in the bottom bar over the
// video. The Watch next button starts with its countdown, such as "14Watch next", so the text is matched at the end.
// TODO: Validate
function findBottomBarButton(buttonTextEnding: string): HTMLElement | null {
  const bottomBarButtons = findVisibleElements(document, ".video-wrapper .bottom-bar button");
  return (
    bottomBarButtons.find((bottomBarButton) =>
      (bottomBarButton.textContent ?? "").trim().toLowerCase().endsWith(buttonTextEnding),
    ) ?? null
  );
}

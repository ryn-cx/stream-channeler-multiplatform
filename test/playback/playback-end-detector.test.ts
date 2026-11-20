// TODO: Validate
import { describe, expect, it } from "vitest";
import { MediaIdChangeEndsVideo } from "../../src/playback/endrules/media-id-change-ends-video";
import { OnScreenElementEndsVideo } from "../../src/playback/endrules/on-screen-element-ends-video";
import type { PlaybackEndRule } from "../../src/playback/endrules/playback-end-rule";
import {
  type MediaObservation,
  type ObservedPlaybackStatus,
  PlaybackEndDetector,
} from "../../src/playback/playback-end-detector";
import { playbackEndRulesFor } from "../../src/playback/playback-monitor";
import { disneyPlusSite } from "../../src/streamingsites/disney-plus";
import { huluSite } from "../../src/streamingsites/hulu";
import { tubiSite } from "../../src/streamingsites/tubi";
import { youTubeSite } from "../../src/streamingsites/youtube";

const launchedAt = 1_000_000;
const videoDuration = 30 * 60_000;

// TODO: Validate
function observation(
  playbackStatus: ObservedPlaybackStatus,
  position: number,
  duration: number | null = videoDuration,
  mediaTitle: string | null = "Episode 1",
  playbackSpeed = 1,
): MediaObservation {
  return { playbackStatus, position, duration, mediaTitle, playbackSpeed };
}

// TODO: Validate
function detector(playbackEndRules: PlaybackEndRule[]) {
  return new PlaybackEndDetector(launchedAt, playbackEndRules);
}

// TODO: Validate
function primeVideoObservation(playbackStatus: ObservedPlaybackStatus, position: number, mediaId: string) {
  return { ...observation(playbackStatus, position, null, null), mediaId };
}

describe("PlaybackEndDetector", () => {
  it("finishes a Hulu episode once the address moves to the next episode's watch id", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(huluSite, []));
    const episodeAddress = "https://www.hulu.com/watch/47df678d-d805-4789-a105-775950acc101";
    const nextEpisodeAddress = "https://www.hulu.com/watch/8685a508-1418-48f2-bdee-3de0110532a2";
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0), null, episodeAddress);
    expect(playbackEndDetector.evaluate(launchedAt + 10_000, observation("PLAYING", 5_000), null, episodeAddress)).toBe(
      "STILL_WATCHING",
    );
    expect(playbackEndDetector.evaluate(launchedAt + 15_000, null, null, nextEpisodeAddress)).toBe("FINISHED");
  });

  it("keeps watching while only the query of the episode's address changes", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(huluSite, []));
    playbackEndDetector.evaluate(
      launchedAt + 5_000,
      observation("PLAYING", 0),
      null,
      "https://www.hulu.com/watch/47df678d-d805-4789-a105-775950acc101?trackId=264293154",
    );
    expect(
      playbackEndDetector.evaluate(
        launchedAt + 10_000,
        observation("PLAYING", 5_000),
        null,
        "https://www.hulu.com/watch/47df678d-d805-4789-a105-775950acc101?trackId=155573560",
      ),
    ).toBe("STILL_WATCHING");
    expect(
      playbackEndDetector.evaluate(
        launchedAt + 15_000,
        observation("PLAYING", 0),
        null,
        "https://www.hulu.com/watch/8685a508-1418-48f2-bdee-3de0110532a2?trackId=155573560",
      ),
    ).toBe("FINISHED");
  });

  it("keeps watching on an address the episode id pattern does not match", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(huluSite, []));
    playbackEndDetector.evaluate(
      launchedAt + 5_000,
      observation("PLAYING", 0),
      null,
      "https://www.hulu.com/watch/47df678d-d805-4789-a105-775950acc101",
    );
    expect(
      playbackEndDetector.evaluate(
        launchedAt + 10_000,
        observation("PLAYING", 5_000),
        null,
        "https://www.hulu.com/hub/home",
      ),
    ).toBe("STILL_WATCHING");
  });

  it("does not finish an address-ended website on the video's ended event", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(huluSite, []));
    const episodeAddress = "https://www.hulu.com/watch/47df678d-d805-4789-a105-775950acc101";
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0), null, episodeAddress);
    const promoEndedMedia = { endedAt: launchedAt + 20_000, duration: videoDuration };
    expect(
      playbackEndDetector.evaluate(
        launchedAt + 21_000,
        observation("STOPPED", videoDuration),
        promoEndedMedia,
        episodeAddress,
      ),
    ).toBe("STILL_WATCHING");
  });

  it("finishes when Disney+ shows a play next button", () => {
    let shownPlayNextButton: HTMLElement | null = null;
    const playbackEndDetector = detector([new OnScreenElementEndsVideo(() => shownPlayNextButton)]);
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0));
    expect(playbackEndDetector.evaluate(launchedAt + 840_000, observation("PLAYING", 835_000))).toBe("STILL_WATCHING");
    shownPlayNextButton = {} as HTMLElement;
    expect(playbackEndDetector.evaluate(launchedAt + 846_000, observation("PLAYING", 841_000))).toBe("FINISHED");
  });

  it("finishes when Disney+ shows the full page play next view after the video goes away", () => {
    let shownPlayNextButton: HTMLElement | null = null;
    const playbackEndDetector = detector([new OnScreenElementEndsVideo(() => shownPlayNextButton)]);
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0));
    expect(playbackEndDetector.evaluate(launchedAt + 900_000, null)).toBe("STILL_WATCHING");
    shownPlayNextButton = {} as HTMLElement;
    expect(playbackEndDetector.evaluate(launchedAt + 901_000, null)).toBe("FINISHED");
  });

  it("ends Disney+ videos when the next episode button appears, whichever moments are checked", () => {
    const disneyPlusEndRules = playbackEndRulesFor(disneyPlusSite, []);
    expect(disneyPlusEndRules).toHaveLength(1);
    expect(disneyPlusEndRules[0]).toBeInstanceOf(OnScreenElementEndsVideo);
  });

  it("never ends the video while paused", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(youTubeSite, []));
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 60_000));
    for (let minutesPaused = 0; minutesPaused < 20; minutesPaused++) {
      expect(
        playbackEndDetector.evaluate(launchedAt + 6_000 + minutesPaused * 60_000, observation("PAUSED", 60_000)),
      ).toBe("STILL_WATCHING");
    }
  });

  it("finishes a YouTube video only when the browser signals that the video ended", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(youTubeSite, []));
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0));
    expect(playbackEndDetector.evaluate(launchedAt + 10_000, observation("PLAYING", videoDuration - 1_000))).toBe(
      "STILL_WATCHING",
    );
    expect(
      playbackEndDetector.evaluate(launchedAt + 15_000, observation("PLAYING", 0, videoDuration, "Episode 2")),
    ).toBe("STILL_WATCHING");
    const videoEndedMedia = { endedAt: launchedAt + 20_000, duration: videoDuration };
    expect(
      playbackEndDetector.evaluate(launchedAt + 21_000, observation("STOPPED", videoDuration), videoEndedMedia),
    ).toBe("FINISHED");
  });

  it("gives up when playback never starts", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(youTubeSite, []));
    expect(playbackEndDetector.evaluate(launchedAt + 60_000, null)).toBe("STILL_WATCHING");
    expect(playbackEndDetector.evaluate(launchedAt + 4 * 60_000, null)).toBe("NEVER_STARTED");
  });

  it("finishes as soon as the browser signals the episode's video ended on a website that uses it", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(youTubeSite, []));
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0));
    const episodeEndedMedia = { endedAt: launchedAt + 20_000, duration: videoDuration };
    expect(playbackEndDetector.evaluate(launchedAt + 21_000, observation("STOPPED", 60_000), episodeEndedMedia)).toBe(
      "FINISHED",
    );
  });

  it("ignores the browser signalling a video ended before the video started playing", () => {
    const playbackEndDetector = detector(playbackEndRulesFor(youTubeSite, []));
    const previousVideoEndedMedia = { endedAt: launchedAt + 1_000, duration: videoDuration };
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0), previousVideoEndedMedia);
    expect(
      playbackEndDetector.evaluate(launchedAt + 6_000, observation("PLAYING", 1_000), previousVideoEndedMedia),
    ).toBe("STILL_WATCHING");
  });

  it("finishes when Prime Video autoplays the next episode under a new media ID", () => {
    const playbackEndDetector = detector([new MediaIdChangeEndsVideo()]);
    playbackEndDetector.evaluate(launchedAt + 5_000, primeVideoObservation("PLAYING", 1_190_248, "episode 1"));
    playbackEndDetector.evaluate(launchedAt + 100_000, primeVideoObservation("PLAYING", 1_290_000, "episode 1"));
    expect(playbackEndDetector.evaluate(launchedAt + 101_000, primeVideoObservation("BUFFERING", 0, "episode 2"))).toBe(
      "FINISHED",
    );
  });

  it("plays the next episode at the Skip Credits button only when it is checked", () => {
    let shownSkipCreditsButton: HTMLElement | null = null;
    const siteWithSkipCreditsButton = {
      ...tubiSite,
      skipCreditsButton: { find: () => shownSkipCreditsButton },
    };
    expect(playbackEndRulesFor(siteWithSkipCreditsButton, [])).toHaveLength(1);
    const playbackEndDetector = detector(playbackEndRulesFor(siteWithSkipCreditsButton, ["skipCreditsButton"]));
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0));
    expect(playbackEndDetector.evaluate(launchedAt + 60_000, observation("PLAYING", 55_000))).toBe("STILL_WATCHING");
    shownSkipCreditsButton = {} as HTMLElement;
    expect(playbackEndDetector.evaluate(launchedAt + 61_000, observation("PLAYING", videoDuration - 60_000))).toBe(
      "FINISHED",
    );
  });

  it("plays the next episode when the next episode button appears only when it is checked", () => {
    let shownNextEpisode: HTMLElement | null = null;
    const siteWithNextEpisode = { ...tubiSite, nextEpisodeButton: { find: () => shownNextEpisode } };
    expect(playbackEndRulesFor(siteWithNextEpisode, [])).toHaveLength(1);
    const playbackEndDetector = detector(playbackEndRulesFor(siteWithNextEpisode, ["nextEpisodeButton"]));
    playbackEndDetector.evaluate(launchedAt + 5_000, observation("PLAYING", 0));
    expect(playbackEndDetector.evaluate(launchedAt + 60_000, observation("PLAYING", 55_000))).toBe("STILL_WATCHING");
    shownNextEpisode = {} as HTMLElement;
    expect(playbackEndDetector.evaluate(launchedAt + 61_000, observation("PLAYING", videoDuration - 60_000))).toBe(
      "FINISHED",
    );
  });

  it("keeps only the site's own end rule when the chosen moment is one the site does not have", () => {
    expect(playbackEndRulesFor(youTubeSite, ["skipCreditsButton"])).toHaveLength(1);
    expect(playbackEndRulesFor(youTubeSite, ["nextEpisodeButton"])).toHaveLength(1);
  });
});

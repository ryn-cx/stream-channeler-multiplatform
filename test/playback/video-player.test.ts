// TODO: Validate
import { describe, expect, it } from "vitest";
import type { GuideChannel, GuideVideo } from "../../src/data/models";
import type { ActivePlayback } from "../../src/playback/playback-monitor";
import { nextVideoInPlayedOrLatestOrder, previousVideoInPlayedOrLatestOrder } from "../../src/playback/video-player";

// TODO: Validate
function video(episodeId: string): GuideVideo {
  return {
    episodeId,
    title: "Title",
    subtitle: "",
    url: `https://netflix.com/watch/${episodeId}`,
    durationSeconds: 60,
    thumbnailUrl: null,
    faviconUrl: null,
    sourceKey: "Netflix",
    pluginKey: "Netflix",
    watched: false,
    watchCompleted: false,
    watchId: null,
    titleId: null,
    description: null,
  };
}

// TODO: Validate
function endedPlaybackOf(playedEpisodeIds: string[], endedEpisodeId: string): ActivePlayback {
  return {
    channelId: "channel",
    channelName: "Channel",
    channelVideos: playedEpisodeIds.map(video),
    playingEpisodeId: endedEpisodeId,
    streamingSitePluginKey: "Netflix",
    launchedAt: 0,
    isMonitoring: true,
  };
}

// TODO: Validate
function latestChannelOf(latestEpisodeIds: string[]): GuideChannel {
  return {
    id: "channel",
    name: "Channel",
    number: 1,
    defaultOrder: "shuffled",
    videos: latestEpisodeIds.map(video),
    imageUrl: null,
    hasMoreVideos: false,
    authorUsername: null,
  };
}

describe("nextVideoInPlayedOrLatestOrder", () => {
  it("prefers the episode order saved at launch over a reshuffled guide", () => {
    const nextVideoAfterEndedPlayback = nextVideoInPlayedOrLatestOrder(
      endedPlaybackOf(["a", "b", "c"], "a"),
      latestChannelOf(["a", "c", "b"]),
    );
    expect(nextVideoAfterEndedPlayback?.video.episodeId).toBe("b");
    expect(nextVideoAfterEndedPlayback?.channel.defaultOrder).toBe("shuffled");
  });

  it("falls back to the latest guide when the saved order has no next episode", () => {
    const latestChannel = latestChannelOf(["a", "b", "c"]);
    const nextVideoAfterEndedPlayback = nextVideoInPlayedOrLatestOrder(endedPlaybackOf(["a", "b"], "b"), latestChannel);
    expect(nextVideoAfterEndedPlayback?.video.episodeId).toBe("c");
    expect(nextVideoAfterEndedPlayback?.channel).toBe(latestChannel);
  });

  it("has no next video after the last episode of both orders", () => {
    expect(nextVideoInPlayedOrLatestOrder(endedPlaybackOf(["a", "b"], "b"), latestChannelOf(["a", "b"]))).toBeNull();
    expect(nextVideoInPlayedOrLatestOrder(endedPlaybackOf(["a", "b"], "b"), null)).toBeNull();
  });
});

describe("previousVideoInPlayedOrLatestOrder", () => {
  it("prefers the episode order saved at launch over a reshuffled guide", () => {
    const previousVideoBeforeSkippedPlayback = previousVideoInPlayedOrLatestOrder(
      endedPlaybackOf(["a", "b", "c"], "c"),
      latestChannelOf(["b", "a", "c"]),
    );
    expect(previousVideoBeforeSkippedPlayback?.video.episodeId).toBe("b");
  });

  it("falls back to the latest guide when the saved order has no earlier episode", () => {
    const latestChannel = latestChannelOf(["z", "a", "b"]);
    const previousVideoBeforeSkippedPlayback = previousVideoInPlayedOrLatestOrder(
      endedPlaybackOf(["a", "b"], "a"),
      latestChannel,
    );
    expect(previousVideoBeforeSkippedPlayback?.video.episodeId).toBe("z");
    expect(previousVideoBeforeSkippedPlayback?.channel).toBe(latestChannel);
  });

  it("has no previous video before the first episode of both orders", () => {
    expect(
      previousVideoInPlayedOrLatestOrder(endedPlaybackOf(["a", "b"], "a"), latestChannelOf(["a", "b"])),
    ).toBeNull();
    expect(previousVideoInPlayedOrLatestOrder(endedPlaybackOf(["a", "b"], "a"), null)).toBeNull();
  });
});

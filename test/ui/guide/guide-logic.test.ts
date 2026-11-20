// TODO: Validate
import { describe, expect, it } from "vitest";
import { describeLoadError, isSignInRejectedError } from "../../../src/data/load-errors";
import { type GuideChannel, type GuideVideo, nextPlayableVideo, previousPlayableVideo } from "../../../src/data/models";
import { ApiException } from "../../../src/data/stream-channeler-api";
import { hasDarkEdgesOnTransparency } from "../../../src/ui/guide/channel-logo-background";
import { scheduleChannelVideos } from "../../../src/ui/guide/guide-row";

// TODO: Validate
function video(
  episodeId: string,
  durationSeconds: number | null,
  url: string | null = `https://netflix.com/watch/${episodeId}`,
): GuideVideo {
  return {
    episodeId,
    title: "Title",
    subtitle: "",
    url,
    durationSeconds,
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
function squareLogoOnTransparency(logoArgb: number): number[] {
  return Array.from({ length: 100 }, (_, pixelIndex) => {
    const pixelX = pixelIndex % 10;
    const pixelY = Math.floor(pixelIndex / 10);
    return pixelX >= 3 && pixelX <= 6 && pixelY >= 3 && pixelY <= 6 ? logoArgb : 0;
  });
}

describe("guide logic", () => {
  it("schedules videos back to back with a five minute minimum", () => {
    const scheduledVideos = scheduleChannelVideos([video("a", 2640), video("b", 6), video("c", null)], 5);
    expect(scheduledVideos.map((scheduledVideo) => scheduledVideo.startMinute)).toEqual([0, 44, 49]);
    expect(scheduledVideos.map((scheduledVideo) => scheduledVideo.minutes)).toEqual([44, 5, 30]);
  });

  it("skips videos without links when picking the next playable video", () => {
    const channel: GuideChannel = {
      id: "channel",
      name: "Channel",
      number: 1,
      defaultOrder: null,
      videos: [video("a", 60), video("b", 60, null), video("c", 60)],
      imageUrl: null,
      hasMoreVideos: false,
      authorUsername: null,
    };
    expect(nextPlayableVideo(channel, "a")?.episodeId).toBe("c");
    expect(nextPlayableVideo(channel, "c")).toBeNull();
    expect(nextPlayableVideo(channel, "missing")?.episodeId).toBe("a");
  });

  it("skips videos without links when picking the previous playable video", () => {
    const channel: GuideChannel = {
      id: "channel",
      name: "Channel",
      number: 1,
      defaultOrder: null,
      videos: [video("a", 60), video("b", 60, null), video("c", 60)],
      imageUrl: null,
      hasMoreVideos: false,
      authorUsername: null,
    };
    expect(previousPlayableVideo(channel, "c")?.episodeId).toBe("a");
    expect(previousPlayableVideo(channel, "a")).toBeNull();
    expect(previousPlayableVideo(channel, "missing")).toBeNull();
  });

  it("gives dark logos on transparency a light background", () => {
    expect(hasDarkEdgesOnTransparency(squareLogoOnTransparency(0xff101010), 10, 10)).toBe(true);
    expect(hasDarkEdgesOnTransparency(squareLogoOnTransparency(0xfff0f0f0), 10, 10)).toBe(false);
    expect(
      hasDarkEdgesOnTransparency(
        Array.from({ length: 100 }, () => 0xff101010),
        10,
        10,
      ),
    ).toBe(false);
  });

  it("describes expired sign-ins and server answers", () => {
    expect(describeLoadError(new ApiException(403, "Could not validate credentials", true))).toBe(
      "your sign-in has expired",
    );
    expect(isSignInRejectedError(new ApiException(401, "Unauthorized", true))).toBe(true);
    expect(isSignInRejectedError(new ApiException(403, "Forbidden"))).toBe(false);
    expect(describeLoadError(new ApiException(500, "Internal Server Error"))).toBe(
      "the server answered 500: Internal Server Error",
    );
    expect(describeLoadError(new DOMException("timeout", "TimeoutError"))).toBe("the server took too long to answer");
  });
});

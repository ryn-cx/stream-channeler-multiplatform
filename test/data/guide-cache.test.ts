// TODO: Validate
import { describe, expect, it } from "vitest";
import { cachedGuideFromStoredValue } from "../../src/data/guide-cache";
import { JsonShapeError } from "../../src/data/json-fields";

describe("cachedGuideFromStoredValue", () => {
  it("fills in defaults for fields an older cache did not save", () => {
    const cachedGuide = cachedGuideFromStoredValue({
      channels: [{ id: "channel-1", videos: [{ episodeId: "episode-1", url: "https://tubitv.com/1" }] }],
      guideScopeToChannelIds: { PUBLIC: ["channel-1"], UNKNOWN_SCOPE: ["channel-2"] },
    });

    expect(cachedGuide.updatedAt).toBe(0);
    expect(cachedGuide.favoriteChannelIds).toEqual([]);
    expect(cachedGuide.guideScopeToChannelIds).toEqual({ PUBLIC: ["channel-1"], FAVORITES: [], OWNED: [] });
    expect(cachedGuide.channels[0]).toMatchObject({ id: "channel-1", name: null, hasMoreVideos: false });
    expect(cachedGuide.channels[0]?.videos[0]).toMatchObject({
      episodeId: "episode-1",
      subtitle: "",
      sourceKey: "",
      url: "https://tubitv.com/1",
      watched: false,
      watchCompleted: false,
      watchId: null,
    });
  });

  it("keeps every saved field of a cache written by this version", () => {
    const savedGuide = {
      channels: [
        {
          id: "channel-1",
          name: "Cartoons",
          number: 5.1,
          defaultOrder: "{}",
          videos: [
            {
              episodeId: "episode-1",
              title: "Show",
              subtitle: "S1 Ep2 · Pilot",
              url: "https://tubitv.com/1",
              durationSeconds: 1320,
              thumbnailUrl: "https://image/1",
              faviconUrl: "https://favicon/1",
              sourceKey: "Tubi",
              pluginKey: "Tubi",
              watched: true,
              watchCompleted: true,
              watchId: "watch-1",
              titleId: "title-1",
              description: "An episode",
            },
          ],
          imageUrl: "https://image/channel",
          hasMoreVideos: true,
          authorUsername: "someone",
        },
      ],
      favoriteChannelIds: ["channel-1"],
      guideScopeToChannelIds: { PUBLIC: ["channel-1"], FAVORITES: ["channel-1"], OWNED: [] },
      updatedAt: 1234,
    };

    expect(cachedGuideFromStoredValue(savedGuide)).toEqual(savedGuide);
  });

  it("rejects a cache that is not an object or has a channel without an id", () => {
    expect(() => cachedGuideFromStoredValue("not a guide")).toThrow(JsonShapeError);
    expect(() => cachedGuideFromStoredValue({ channels: [{ name: "No id" }] })).toThrow(JsonShapeError);
  });
});

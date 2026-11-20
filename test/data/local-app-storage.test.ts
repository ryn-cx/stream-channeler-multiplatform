// TODO: Validate
import { beforeEach, describe, expect, it, vi } from "vitest";

const gmValueKeyToStoredValue = new Map<string, unknown>();

vi.mock("../../src/userscript/gm-values", () => ({
  readGmValue: async (valueKey: string) => gmValueKeyToStoredValue.get(valueKey),
  writeGmValue: async (valueKey: string, storedValue: unknown) => {
    if (storedValue === null || storedValue === undefined) {
      gmValueKeyToStoredValue.delete(valueKey);
    } else {
      gmValueKeyToStoredValue.set(valueKey, storedValue);
    }
  },
  listenForGmValueChange: () => () => undefined,
}));

const { LocalAppStorage } = await import("../../src/data/local-app-storage");

describe("LocalAppStorage", () => {
  beforeEach(() => gmValueKeyToStoredValue.clear());

  it("uses the Android app's defaults", async () => {
    const localAppStorage = await LocalAppStorage.load();
    expect(localAppStorage.showsUpNextInformation).toBe(false);
    expect(localAppStorage.streamingSiteSettings("Crunchyroll").checkedPlayNextEpisodeMoments).toEqual([]);
    expect(localAppStorage.afterVideoEnds).toBe("PLAY_NEXT_VIDEO");
    expect(localAppStorage.guideScope).toBe("PUBLIC");
  });

  it("falls back to the default when a saved choice is no longer one of the choices", async () => {
    gmValueKeyToStoredValue.set("guideScope", "REMOVED_SCOPE");
    gmValueKeyToStoredValue.set("afterVideoEnds", "RETURN_TO_GUIDE");
    const localAppStorage = await LocalAppStorage.load();
    expect(localAppStorage.guideScope).toBe("PUBLIC");
    expect(localAppStorage.afterVideoEnds).toBe("RETURN_TO_GUIDE");
  });

  it("reads the account's profile name and ignores the number that only the Android app uses", async () => {
    gmValueKeyToStoredValue.set("accessToken", "token");
    gmValueKeyToStoredValue.set("accountUserJson", {
      plugin_key_to_profile: { Netflix: { profile_name: "Kids", profile_number: 3 }, Hulu: { profile_number: 2 } },
    });
    const localAppStorage = await LocalAppStorage.load();
    expect(localAppStorage.streamingProfileName("Netflix")).toBe("Kids");
    expect(localAppStorage.streamingProfileName("Hulu")).toBe("");
  });

  it("raises the minimum episode seed above every channel's seed and forgets the channel seeds", async () => {
    const localAppStorage = await LocalAppStorage.load();
    localAppStorage.saveLocalChannelEpisodeSeed("channel-1", 4);
    localAppStorage.advanceLocalMinimumEpisodeSeed();
    expect(localAppStorage.loadLocalSeeds()).toEqual({
      minimumEpisodeOrderSeed: 5,
      channelOrderSeed: 0,
      channelIdToEpisodeOrderSeed: {},
    });
  });
});

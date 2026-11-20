// TODO: Validate
import { describe, expect, it } from "vitest";
import { upNextAnnouncement } from "../../../src/ui/upnext/up-next-announcement";

describe("upNextAnnouncement", () => {
  it("says the title and episode name without season and episode numbers", () => {
    expect(upNextAnnouncement("Blue Ribbon Baking Championship", "S1 Ep8 · Crowning the Champion")).toBe(
      "Up next: Blue Ribbon Baking Championship. Crowning the Champion.",
    );
  });

  it("says only the title when the subtitle is only numbers", () => {
    expect(upNextAnnouncement("Bluey", "S2 Ep14")).toBe("Up next: Bluey.");
  });

  it("keeps subtitles that are not episode numbers", () => {
    expect(upNextAnnouncement("Night Mind", "Black Horizon: Explained")).toBe(
      "Up next: Night Mind. Black Horizon: Explained.",
    );
  });

  it("says the following video after Then", () => {
    expect(upNextAnnouncement("Bluey", "S2 Ep14 · Dad Baby", "Night Mind", "Black Horizon: Explained")).toBe(
      "Up next: Bluey. Dad Baby. Then: Night Mind. Black Horizon: Explained.",
    );
  });

  it("says only the episode name when the following video is the same show", () => {
    expect(upNextAnnouncement("Bluey", "S2 Ep14 · Dad Baby", "Bluey", "S2 Ep26 · Sleepytime")).toBe(
      "Up next: Bluey. Dad Baby. Then: Sleepytime.",
    );
  });

  it("says the show name when the same-show following video has no episode name", () => {
    expect(upNextAnnouncement("Bluey", "S2 Ep14 · Dad Baby", "Bluey", "S2 Ep26")).toBe(
      "Up next: Bluey. Dad Baby. Then: Bluey.",
    );
  });

  it("says Up next alone without any name", () => {
    expect(upNextAnnouncement(null, "")).toBe("Up next.");
  });
});

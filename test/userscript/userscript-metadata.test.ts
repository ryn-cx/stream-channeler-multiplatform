// TODO: Validate
import { describe, expect, it } from "vitest";
import userscriptMetadata from "../../config/metadata.cjs";
import { ALL_STREAMING_SITES } from "../../src/streamingsites/streaming-site";
import { isGuidePage } from "../../src/userscript/userscript-pages";

describe("userscript metadata", () => {
  it("matches every streaming website the player page supports", () => {
    const unmatchedDomains = ALL_STREAMING_SITES.flatMap((streamingSite) =>
      streamingSite.domains.filter((domain) => !userscriptMetadata.match.includes(`https://*.${domain}/*`)),
    );
    expect(unmatchedDomains).toEqual([]);
  });

  it("matches every streamchanneler.com page, so the website's header gets the Open App link", () => {
    expect(userscriptMetadata.match).toContain("https://streamchanneler.com/*");
  });
});

describe("userscript pages", () => {
  it("recognizes the guide page", () => {
    expect(isGuidePage(new URL("https://streamchanneler.com/open-app"))).toBe(true);
    expect(isGuidePage(new URL("https://streamchanneler.com/open-app/"))).toBe(true);
    expect(isGuidePage(new URL("https://www.netflix.com/open-app"))).toBe(false);
  });
});

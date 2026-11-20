// TODO: Validate
import { describe, expect, it } from "vitest";
import { ChannelSearchAndShowFilter } from "../../src/data/channel-search-and-show-filter";
import { channelListQuery, PagedChannelList } from "../../src/data/paged-channel-list";

describe("PagedChannelList", () => {
  it("is loading its first page only until a channel arrives or the list runs out", () => {
    const pagedChannelList = new PagedChannelList([channelListQuery("PUBLIC")]);
    expect(pagedChannelList.isLoadingFirstPage).toBe(false);

    pagedChannelList.loadStatus = "LOADING";
    expect(pagedChannelList.isLoadingFirstPage).toBe(true);

    pagedChannelList.channelIds.add("channel-1");
    expect(pagedChannelList.hasLoadedFirstPage).toBe(true);
    expect(pagedChannelList.isLoadingFirstPage).toBe(false);

    const emptyPagedChannelList = new PagedChannelList([channelListQuery("PUBLIC")]);
    emptyPagedChannelList.loadStatus = "EXHAUSTED";
    expect(emptyPagedChannelList.hasLoadedFirstPage).toBe(true);
  });
});

describe("ChannelSearchAndShowFilter", () => {
  it("searches channel names in one guide tab and ends the search on an empty query", () => {
    const channelSearchAndShowFilter = new ChannelSearchAndShowFilter();
    const searchChannelList = channelSearchAndShowFilter.replaceSearch("news", "FAVORITES");
    if (searchChannelList === null) throw new Error("A non-empty query should start a search");

    expect(searchChannelList.queries).toEqual([
      { guideScope: "FAVORITES", filterOptions: [{ id: "name", value: "news" }], titleId: null },
    ]);
    searchChannelList.loadStatus = "LOADING";
    expect(channelSearchAndShowFilter.isSearchingChannels).toBe(true);

    expect(channelSearchAndShowFilter.replaceSearch("", "FAVORITES")).toBeNull();
    expect(searchChannelList.isDiscarded).toBe(true);
    expect(channelSearchAndShowFilter.isSearchingChannels).toBe(false);
  });

  it("only reports a search error while the first page has not loaded", () => {
    const channelSearchAndShowFilter = new ChannelSearchAndShowFilter();
    const searchChannelList = channelSearchAndShowFilter.replaceSearch("news", "PUBLIC");
    if (searchChannelList === null) throw new Error("A non-empty query should start a search");
    searchChannelList.loadStatus = "FAILED";
    searchChannelList.lastErrorMessage = "the server took too long to answer";
    expect(channelSearchAndShowFilter.lastSearchErrorMessage).toBe("the server took too long to answer");

    searchChannelList.channelIds.add("channel-1");
    expect(channelSearchAndShowFilter.lastSearchErrorMessage).toBeNull();
  });

  it("filters by show across each searched guide tab in turn and clears everything together", () => {
    const channelSearchAndShowFilter = new ChannelSearchAndShowFilter();
    const showFilterChannelList = channelSearchAndShowFilter.replaceShowFilter("title-1", "Show", [
      "FAVORITES",
      "OWNED",
      "PUBLIC",
    ]);

    expect(
      showFilterChannelList.queries.map((showFilterQuery) => [showFilterQuery.guideScope, showFilterQuery.titleId]),
    ).toEqual([
      ["FAVORITES", "title-1"],
      ["OWNED", "title-1"],
      ["PUBLIC", "title-1"],
    ]);

    channelSearchAndShowFilter.replaceSearch("news", "PUBLIC");
    channelSearchAndShowFilter.clearSearchAndShowFilter();
    expect(showFilterChannelList.isDiscarded).toBe(true);
    expect(channelSearchAndShowFilter.showFilterTitleId).toBeNull();
    expect(channelSearchAndShowFilter.showFilterName).toBe("");
    expect(channelSearchAndShowFilter.searchChannelList).toBeNull();
    expect(channelSearchAndShowFilter.channelSearchQuery).toBe("");
  });
});

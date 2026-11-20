// TODO: Validate
import type { GuideScope } from "./models";
import { channelListQuery, PagedChannelList } from "./paged-channel-list";

// TODO: Validate
export class ChannelSearchAndShowFilter {
  channelSearchQuery = "";
  channelSearchScope: GuideScope = "PUBLIC";
  searchChannelList: PagedChannelList | null = null;
  showFilterTitleId: string | null = null;
  showFilterName = "";
  showFilterChannelList: PagedChannelList | null = null;

  // TODO: Validate
  get isSearchingChannels(): boolean {
    return this.searchChannelList?.isLoadingFirstPage === true;
  }

  // TODO: Validate
  get lastSearchErrorMessage(): string | null {
    const searchChannelList = this.searchChannelList;
    return searchChannelList !== null && !searchChannelList.hasLoadedFirstPage
      ? searchChannelList.lastErrorMessage
      : null;
  }

  // TODO: Validate
  get isLoadingShowFilter(): boolean {
    return this.showFilterChannelList?.isLoadingFirstPage === true;
  }

  // TODO: Validate
  get lastShowFilterErrorMessage(): string | null {
    const showFilterChannelList = this.showFilterChannelList;
    return showFilterChannelList !== null && !showFilterChannelList.hasLoadedFirstPage
      ? showFilterChannelList.lastErrorMessage
      : null;
  }

  // TODO: Validate
  replaceSearch(searchQuery: string, guideScope: GuideScope): PagedChannelList | null {
    if (this.searchChannelList !== null) this.searchChannelList.isDiscarded = true;
    this.channelSearchQuery = searchQuery;
    this.channelSearchScope = guideScope;
    if (searchQuery.length === 0) {
      this.searchChannelList = null;
      return null;
    }
    const nameSearchQuery = channelListQuery(guideScope, [{ id: "name", value: searchQuery }]);
    const newSearchChannelList = new PagedChannelList([nameSearchQuery]);
    this.searchChannelList = newSearchChannelList;
    return newSearchChannelList;
  }

  // TODO: Validate
  replaceShowFilter(titleId: string, showName: string, searchedGuideScopes: GuideScope[]): PagedChannelList {
    if (this.showFilterChannelList !== null) this.showFilterChannelList.isDiscarded = true;
    this.showFilterTitleId = titleId;
    this.showFilterName = showName;
    const newShowFilterChannelList = new PagedChannelList(
      searchedGuideScopes.map((guideScope) => channelListQuery(guideScope, [], titleId)),
    );
    this.showFilterChannelList = newShowFilterChannelList;
    return newShowFilterChannelList;
  }

  // TODO: Validate
  clearShowFilter(): void {
    if (this.showFilterChannelList !== null) this.showFilterChannelList.isDiscarded = true;
    this.showFilterChannelList = null;
    this.showFilterTitleId = null;
    this.showFilterName = "";
  }

  // TODO: Validate
  clearSearchAndShowFilter(): void {
    if (this.searchChannelList !== null) this.searchChannelList.isDiscarded = true;
    this.searchChannelList = null;
    this.channelSearchQuery = "";
    this.clearShowFilter();
  }
}

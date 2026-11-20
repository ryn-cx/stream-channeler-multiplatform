// TODO: Validate
import type { JsonObject } from "./json-fields";
import type { GuideScope } from "./models";

export type ChannelListLoadStatus = "IDLE" | "LOADING" | "FAILED" | "EXHAUSTED";

export interface ChannelListQuery {
  guideScope: GuideScope;
  filterOptions: JsonObject[];
  titleId: string | null;
}

// TODO: Validate
export function channelListQuery(
  guideScope: GuideScope,
  filterOptions: JsonObject[] = [],
  titleId: string | null = null,
): ChannelListQuery {
  return { guideScope, filterOptions, titleId };
}

// TODO: Validate
export class PagedChannelList {
  readonly queries: ChannelListQuery[];
  readonly channelIds = new Set<string>();
  queryIndex = 0;
  nextPageIndex = 0;
  loadStatus: ChannelListLoadStatus = "IDLE";
  lastErrorMessage: string | null = null;
  isDiscarded = false;

  // TODO: Validate
  constructor(queries: ChannelListQuery[]) {
    this.queries = queries;
  }

  // TODO: Validate
  get hasLoadedFirstPage(): boolean {
    return this.channelIds.size > 0 || this.loadStatus === "EXHAUSTED";
  }

  // TODO: Validate
  get isLoadingFirstPage(): boolean {
    return !this.hasLoadedFirstPage && this.loadStatus === "LOADING";
  }
}

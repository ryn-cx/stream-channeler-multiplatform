// TODO: Validate
import logoSvgDataUrl from "../assets/logo.svg";
import stylesheetText from "../assets/styles.css";

const GUIDE_PAGE_HOST = "streamchanneler.com";
export const GUIDE_PAGE_PATH = "/open-app";

export const GUIDE_PAGE_URL = `https://${GUIDE_PAGE_HOST}${GUIDE_PAGE_PATH}`;
export const LOGO_URL = logoSvgDataUrl;

// TODO: Validate
function pathWithoutTrailingSlash(pageUrl: URL): string {
  return pageUrl.pathname.replace(/\/+$/, "");
}

// TODO: Validate
export function isGuidePage(pageUrl: URL): boolean {
  return pageUrl.hostname === GUIDE_PAGE_HOST && pathWithoutTrailingSlash(pageUrl) === GUIDE_PAGE_PATH;
}

// TODO: Validate
export function isStreamChannelerWebsitePage(pageUrl: URL): boolean {
  return pageUrl.hostname === GUIDE_PAGE_HOST;
}

// TODO: Validate
export function takeOverPage(pageTitle: string, bodyClassName: string | null): HTMLBodyElement {
  window.stop();
  const pageRootElement = document.documentElement ?? document.appendChild(document.createElement("html"));
  pageRootElement.lang = "en";
  for (const pageRootAttributeName of pageRootElement.getAttributeNames()) {
    if (pageRootAttributeName !== "lang") pageRootElement.removeAttribute(pageRootAttributeName);
  }
  const pageHead = document.createElement("head");
  const viewportMeta = document.createElement("meta");
  viewportMeta.name = "viewport";
  viewportMeta.content = "width=device-width, initial-scale=1";
  const pageTitleElement = document.createElement("title");
  pageTitleElement.textContent = pageTitle;
  const pageIconLink = document.createElement("link");
  pageIconLink.rel = "icon";
  pageIconLink.href = LOGO_URL;
  const pageStyle = document.createElement("style");
  pageStyle.textContent = stylesheetText;
  pageHead.append(viewportMeta, pageTitleElement, pageIconLink, pageStyle);
  const pageBody = document.createElement("body");
  if (bodyClassName !== null) pageBody.className = bodyClassName;
  pageRootElement.replaceChildren(pageHead, pageBody);
  return pageBody;
}

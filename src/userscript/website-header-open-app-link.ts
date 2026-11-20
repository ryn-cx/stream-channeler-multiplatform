// TODO: Validate
import { GUIDE_PAGE_PATH } from "./userscript-pages";

const ADDED_OPEN_APP_LINK_ATTRIBUTE = "data-stream-channeler-open-app-link";

// The header's nav is only shown from Tailwind's md breakpoint (768px) up, and the website's own Open App button is
// the only way to the guide on narrower screens. So the website's button is hidden only where the nav shows.
const HIDE_WEBSITE_OPEN_APP_BUTTON_STYLE = `
  @media (min-width: 768px) {
    header a[href="${GUIDE_PAGE_PATH}"]:not([${ADDED_OPEN_APP_LINK_ATTRIBUTE}]) {
      display: none !important;
    }
  }
`;

// TODO: Validate
/**
 * Adds an Open App link to the end of the left navigation in streamchanneler.com's header, styled like the links next
 * to it, and hides the website's Open App button on the right.
 */
export function startWebsiteHeaderOpenAppLink(): void {
  const hideWebsiteOpenAppButtonStyleElement = document.createElement("style");
  hideWebsiteOpenAppButtonStyleElement.textContent = HIDE_WEBSITE_OPEN_APP_BUTTON_STYLE;
  document.head.append(hideWebsiteOpenAppButtonStyleElement);
  addOpenAppLinkToHeaderNav();
  // The website is a single page app that can draw its header again on navigation, which drops the added link.
  new MutationObserver(addOpenAppLinkToHeaderNav).observe(document.body, { childList: true, subtree: true });
}

// TODO: Validate
function addOpenAppLinkToHeaderNav(): void {
  if (document.querySelector(`[${ADDED_OPEN_APP_LINK_ATTRIBUTE}]`) !== null) return;
  const headerNav = document.querySelector("header nav");
  if (headerNav === null) return;
  // The link for the page being shown has different classes, so the classes are copied from a link that is not it.
  const inactiveHeaderNavLink =
    headerNav.querySelector<HTMLAnchorElement>("a:not([aria-current])") ?? headerNav.querySelector("a");
  if (inactiveHeaderNavLink === null) return;
  const addedOpenAppLink = document.createElement("a");
  addedOpenAppLink.href = GUIDE_PAGE_PATH;
  addedOpenAppLink.className = inactiveHeaderNavLink.className;
  addedOpenAppLink.textContent = "Open App";
  addedOpenAppLink.setAttribute(ADDED_OPEN_APP_LINK_ATTRIBUTE, "");
  headerNav.append(addedOpenAppLink);
}

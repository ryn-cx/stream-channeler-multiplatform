// TODO: Validate

// TODO: Validate
/**
 * Returns the elements in pageDocument and its open shadow roots that match elementSelector and that the viewer can
 * see. Returns nothing while the tab is hidden, which matches the app only reading the window in front.
 */
export function findVisibleElements(pageDocument: Document, elementSelector: string): HTMLElement[] {
  if (pageDocument.visibilityState === "hidden") return [];
  const matchingElements: Element[] = [];
  collectMatchingElements(pageDocument, elementSelector, matchingElements);
  return matchingElements.filter(isVisibleHtmlElement);
}

// TODO: Validate
/** Returns the first visible HTML element in pageDocument that matches elementSelector, or null when none shows. */
export function findFirstVisibleElement(pageDocument: Document, elementSelector: string): HTMLElement | null {
  return findVisibleElements(pageDocument, elementSelector)[0] ?? null;
}

// TODO: Validate
/**
 * Returns the visible elements matching elementSelector that sit inside an element matching hostSelector, including
 * those in the host's open shadow root. Sites built from web components draw their buttons in shadow roots, and a
 * selector cannot reach from a host into its shadow root.
 */
export function findVisibleElementsInsideHosts(
  pageDocument: Document,
  hostSelector: string,
  elementSelector: string,
): HTMLElement[] {
  if (pageDocument.visibilityState === "hidden") return [];
  const hostElements: Element[] = [];
  collectMatchingElements(pageDocument, hostSelector, hostElements);
  const elementsInsideHosts: Element[] = [];
  for (const hostElement of hostElements) {
    elementsInsideHosts.push(...hostElement.querySelectorAll(elementSelector));
    if (hostElement.shadowRoot !== null) {
      collectMatchingElements(hostElement.shadowRoot, elementSelector, elementsInsideHosts);
    }
  }
  return elementsInsideHosts.filter(isVisibleHtmlElement);
}

// TODO: Validate
function collectMatchingElements(
  searchRoot: Document | ShadowRoot,
  elementSelector: string,
  matchingElements: Element[],
): void {
  matchingElements.push(...searchRoot.querySelectorAll(elementSelector));
  const ownerDocument = searchRoot instanceof Document ? searchRoot : searchRoot.ownerDocument;
  const elementWalker = ownerDocument.createTreeWalker(searchRoot, NodeFilter.SHOW_ELEMENT);
  for (let walkedNode = elementWalker.nextNode(); walkedNode !== null; walkedNode = elementWalker.nextNode()) {
    const walkedShadowRoot = (walkedNode as Element).shadowRoot;
    if (walkedShadowRoot !== null) collectMatchingElements(walkedShadowRoot, elementSelector, matchingElements);
  }
}

// TODO: Validate
// Only HTML elements are kept, so callers get elements they can click and focus without checking the type again.
function isVisibleHtmlElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const elementBounds = element.getBoundingClientRect();
  if (elementBounds.width <= 0 || elementBounds.height <= 0) return false;
  // Sites such as Hulu hide a button by fading out a wrapper around it, and the button's own style does not show that.
  // checkVisibility also looks at every ancestor's display, visibility and opacity.
  return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
}

// TODO: Validate
/**
 * Returns the first of candidateElements whose trimmed text equals elementText, ignoring case, or null when none
 * does. Sites that reuse one button for several skips tell them apart by the button's label.
 */
export function findElementWithText(candidateElements: Element[], elementText: string): HTMLElement | null {
  const lowercaseElementText = elementText.toLowerCase();
  const elementWithText = candidateElements.find(
    (candidateElement) => (candidateElement.textContent ?? "").trim().toLowerCase() === lowercaseElementText,
  );
  return elementWithText instanceof HTMLElement ? elementWithText : null;
}

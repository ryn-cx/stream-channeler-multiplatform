// TODO: Validate
export const UiColors = {
  BACKGROUND: "#0a0a0a",
  SURFACE: "#171717",
  SURFACE_RAISED: "#222222",
  HEADER: "#262626",
  BORDER: "#303030",
  TEXT: "#fafafa",
  TEXT_SECONDARY: "#d4d4d4",
  TEXT_MUTED: "#a3a3a3",
  ACCENT: "#14b8a6",
  ON_ACCENT: "#042f2e",
  ACCENT_TINT: "rgba(20, 184, 166, 0.1)",
  NOW_LINE: "#ef4444",
  STAR: "#facc15",
  ERROR: "#f87171",
} as const;

let appliedZoomScale = 1;

// TODO: Validate
/** Returns the zoom chosen in the settings as a multiplier. The guide grid multiplies its sizes by it. */
export function zoomScale(): number {
  return appliedZoomScale;
}

// TODO: Validate
/**
 * Scales every rem size and the guide grid by zoomPercent, like the browser's own zoom. Unlike CSS zoom, it keeps the
 * guide grid's canvas sharp and its pointer positions correct.
 */
export function applyZoom(zoomPercent: number): void {
  appliedZoomScale = zoomPercent / 100;
  document.documentElement.style.fontSize = `${16 * appliedZoomScale}px`;
}

export function actionButton(buttonLabel: string, onClick: () => void, extraClassName = ""): HTMLButtonElement {
  const createdButton = document.createElement("button");
  createdButton.type = "button";
  createdButton.className = `action-button ${extraClassName}`.trim();
  createdButton.textContent = buttonLabel;
  createdButton.addEventListener("click", () => onClick());
  return createdButton;
}

// TODO: Validate
export function textLabel(labelText: string, className: string): HTMLDivElement {
  const createdLabel = document.createElement("div");
  createdLabel.className = className;
  createdLabel.textContent = labelText;
  return createdLabel;
}

// TODO: Validate
export function textInput(placeholderText: string, inputType = "text"): HTMLInputElement {
  const createdInput = document.createElement("input");
  createdInput.type = inputType;
  createdInput.className = "text-input";
  createdInput.placeholder = placeholderText;
  createdInput.autocomplete = "off";
  createdInput.spellcheck = false;
  return createdInput;
}

// TODO: Validate
export function setShown(shownElement: HTMLElement, isShown: boolean): void {
  shownElement.hidden = !isShown;
}

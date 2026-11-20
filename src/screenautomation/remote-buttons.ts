// TODO: Validate
// TODO: Validate
export function isBackKey(keyboardEvent: KeyboardEvent): boolean {
  if (keyboardEvent.key === "Escape" || keyboardEvent.key === "BrowserBack" || keyboardEvent.key === "GoBack") {
    return true;
  }
  if (keyboardEvent.key !== "Backspace") return false;
  const keyTarget = keyboardEvent.target;
  return !(
    keyTarget instanceof HTMLInputElement ||
    keyTarget instanceof HTMLTextAreaElement ||
    (keyTarget instanceof HTMLElement && keyTarget.isContentEditable)
  );
}

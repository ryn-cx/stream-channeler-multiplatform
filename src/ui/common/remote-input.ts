// TODO: Validate
export type RemoteAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "selectHeld"
  | "back"
  | "menu"
  | "pageUp"
  | "pageDown"
  | "timelineEarlier"
  | "timelineLater"
  | "home"
  | "end"
  | "channel"
  | "search"
  | "refresh"
  | "settings"
  | "guide"
  | "play";

export interface RemoteActionHandler {
  handleRemoteAction(remoteAction: RemoteAction): boolean;
}

const SELECT_HOLD_DURATION = 500;
const GAMEPAD_STICK_THRESHOLD = 0.5;

const KEY_TO_REMOTE_ACTION: Record<string, RemoteAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Escape: "back",
  BrowserBack: "back",
  GoBack: "back",
  Backspace: "back",
  ContextMenu: "menu",
  m: "menu",
  PageUp: "pageUp",
  PageDown: "pageDown",
  ChannelUp: "pageUp",
  ChannelDown: "pageDown",
  ",": "timelineEarlier",
  "[": "timelineEarlier",
  MediaRewind: "timelineEarlier",
  ".": "timelineLater",
  "]": "timelineLater",
  MediaFastForward: "timelineLater",
  Home: "home",
  End: "end",
  c: "channel",
  "/": "search",
  r: "refresh",
  s: "settings",
  g: "guide",
  MediaPlay: "play",
  MediaPlayPause: "play",
};

const TEXT_INPUT_KEY_TO_REMOTE_ACTION: Record<string, RemoteAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  Escape: "back",
  Enter: "select",
};

const GAMEPAD_BUTTON_TO_REMOTE_ACTION: Record<number, RemoteAction> = {
  1: "back",
  2: "search",
  3: "channel",
  4: "timelineEarlier",
  5: "timelineLater",
  6: "pageUp",
  7: "pageDown",
  8: "refresh",
  9: "menu",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

const REPEATING_GAMEPAD_ACTIONS = new Set<RemoteAction>(["up", "down", "left", "right"]);
// The Android app acts only on the first key-down of every other key. Holding a key such as c or r would otherwise
// resort a channel or refresh the guide over and over.
const REPEATING_KEYBOARD_ACTIONS = new Set<RemoteAction>([
  "up",
  "down",
  "left",
  "right",
  "pageUp",
  "pageDown",
  "timelineEarlier",
  "timelineLater",
  "home",
  "end",
]);

// TODO: Validate
function isTextInput(keyTarget: EventTarget | null): boolean {
  return (
    keyTarget instanceof HTMLTextAreaElement ||
    (keyTarget instanceof HTMLInputElement && !["button", "checkbox", "radio"].includes(keyTarget.type))
  );
}

// TODO: Validate
export class RemoteInput {
  private readonly handlerStack: RemoteActionHandler[] = [];
  private selectHoldTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private wasSelectHeld = false;
  private isSelectKeyDown = false;
  private readonly gamepadActionToNextRepeat = new Map<RemoteAction, number>();
  private gamepadSelectPressedAt: number | null = null;
  private wasGamepadSelectHeld = false;
  private isPollingGamepads = false;

  // TODO: Validate
  constructor() {
    window.addEventListener("keydown", (keyboardEvent) => this.handleKeyDown(keyboardEvent), true);
    window.addEventListener("keyup", (keyboardEvent) => this.handleKeyUp(keyboardEvent), true);
    window.addEventListener("gamepadconnected", () => this.startPollingGamepads());
    window.addEventListener("blur", () => this.cancelSelectHold());
  }

  // TODO: Validate
  pushHandler(remoteActionHandler: RemoteActionHandler): void {
    this.handlerStack.push(remoteActionHandler);
  }

  // TODO: Validate
  removeHandler(remoteActionHandler: RemoteActionHandler): void {
    const handlerIndex = this.handlerStack.lastIndexOf(remoteActionHandler);
    if (handlerIndex >= 0) this.handlerStack.splice(handlerIndex, 1);
  }

  // TODO: Validate
  dispatch(remoteAction: RemoteAction): boolean {
    const topHandler = this.handlerStack[this.handlerStack.length - 1];
    return topHandler?.handleRemoteAction(remoteAction) ?? false;
  }

  // TODO: Validate
  private handleKeyDown(keyboardEvent: KeyboardEvent): void {
    if (keyboardEvent.ctrlKey || keyboardEvent.altKey || keyboardEvent.metaKey) return;
    if (isTextInput(keyboardEvent.target)) {
      const textInputAction = TEXT_INPUT_KEY_TO_REMOTE_ACTION[keyboardEvent.key];
      if (textInputAction !== undefined && this.dispatch(textInputAction)) keyboardEvent.preventDefault();
      return;
    }
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      if (keyboardEvent.repeat || this.isSelectKeyDown) return;
      this.isSelectKeyDown = true;
      this.wasSelectHeld = false;
      this.selectHoldTimeoutId = setTimeout(() => {
        this.selectHoldTimeoutId = null;
        this.wasSelectHeld = true;
        this.dispatch("selectHeld");
      }, SELECT_HOLD_DURATION);
      return;
    }
    const remoteAction = KEY_TO_REMOTE_ACTION[keyboardEvent.key];
    if (remoteAction === undefined) return;
    if (keyboardEvent.repeat && !REPEATING_KEYBOARD_ACTIONS.has(remoteAction)) {
      keyboardEvent.preventDefault();
      return;
    }
    if (this.dispatch(remoteAction)) keyboardEvent.preventDefault();
  }

  // TODO: Validate
  private handleKeyUp(keyboardEvent: KeyboardEvent): void {
    if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") return;
    if (!this.isSelectKeyDown) return;
    keyboardEvent.preventDefault();
    const wasSelectHeld = this.wasSelectHeld;
    this.cancelSelectHold();
    if (!wasSelectHeld) this.dispatch("select");
  }

  // TODO: Validate
  private cancelSelectHold(): void {
    if (this.selectHoldTimeoutId !== null) clearTimeout(this.selectHoldTimeoutId);
    this.selectHoldTimeoutId = null;
    this.isSelectKeyDown = false;
    this.wasSelectHeld = false;
  }

  // TODO: Validate
  private startPollingGamepads(): void {
    if (this.isPollingGamepads) return;
    this.isPollingGamepads = true;
    requestAnimationFrame((frame) => this.pollGamepads(frame));
  }

  // TODO: Validate
  private pollGamepads(frame: number): void {
    const connectedGamepads = navigator.getGamepads().filter((gamepad) => gamepad !== null);
    if (connectedGamepads.length === 0) {
      this.isPollingGamepads = false;
      return;
    }
    const pressedActions = new Set<RemoteAction>();
    let isSelectPressed = false;
    for (const gamepad of connectedGamepads) {
      gamepad.buttons.forEach((gamepadButton, buttonIndex) => {
        if (!gamepadButton.pressed) return;
        if (buttonIndex === 0) isSelectPressed = true;
        const buttonAction = GAMEPAD_BUTTON_TO_REMOTE_ACTION[buttonIndex];
        if (buttonAction !== undefined) pressedActions.add(buttonAction);
      });
      const [horizontalAxis = 0, verticalAxis = 0] = gamepad.axes;
      if (horizontalAxis <= -GAMEPAD_STICK_THRESHOLD) pressedActions.add("left");
      if (horizontalAxis >= GAMEPAD_STICK_THRESHOLD) pressedActions.add("right");
      if (verticalAxis <= -GAMEPAD_STICK_THRESHOLD) pressedActions.add("up");
      if (verticalAxis >= GAMEPAD_STICK_THRESHOLD) pressedActions.add("down");
    }
    for (const releasedAction of [...this.gamepadActionToNextRepeat.keys()]) {
      if (!pressedActions.has(releasedAction)) this.gamepadActionToNextRepeat.delete(releasedAction);
    }
    for (const pressedAction of pressedActions) {
      const nextRepeat = this.gamepadActionToNextRepeat.get(pressedAction);
      if (nextRepeat === undefined) {
        this.dispatch(pressedAction);
        this.gamepadActionToNextRepeat.set(
          pressedAction,
          REPEATING_GAMEPAD_ACTIONS.has(pressedAction) ? frame + 400 : Number.POSITIVE_INFINITY,
        );
      } else if (frame >= nextRepeat) {
        this.dispatch(pressedAction);
        this.gamepadActionToNextRepeat.set(pressedAction, frame + 120);
      }
    }
    this.pollGamepadSelect(isSelectPressed, frame);
    requestAnimationFrame((nextFrame) => this.pollGamepads(nextFrame));
  }

  // TODO: Validate
  private pollGamepadSelect(isSelectPressed: boolean, frame: number): void {
    if (isSelectPressed) {
      if (this.gamepadSelectPressedAt === null) {
        this.gamepadSelectPressedAt = frame;
        this.wasGamepadSelectHeld = false;
      } else if (!this.wasGamepadSelectHeld && frame - this.gamepadSelectPressedAt >= SELECT_HOLD_DURATION) {
        this.wasGamepadSelectHeld = true;
        this.dispatch("selectHeld");
      }
      return;
    }
    if (this.gamepadSelectPressedAt !== null && !this.wasGamepadSelectHeld) this.dispatch("select");
    this.gamepadSelectPressedAt = null;
    this.wasGamepadSelectHeld = false;
  }
}

// TODO: Validate
export function moveFocusAmong(focusableElements: HTMLElement[], moveDirection: -1 | 1): boolean {
  const enabledElements = focusableElements.filter(
    (focusableElement) =>
      focusableElement.isConnected &&
      focusableElement.offsetParent !== null &&
      !(focusableElement instanceof HTMLButtonElement && focusableElement.disabled) &&
      !(focusableElement instanceof HTMLInputElement && focusableElement.disabled),
  );
  if (enabledElements.length === 0) return false;
  const focusedIndex = enabledElements.indexOf(document.activeElement as HTMLElement);
  const nextIndex =
    focusedIndex < 0 ? 0 : Math.min(enabledElements.length - 1, Math.max(0, focusedIndex + moveDirection));
  enabledElements[nextIndex]?.focus();
  return true;
}

// TODO: Validate
export function clickFocusedElement(): boolean {
  const focusedElement = document.activeElement;
  if (!(focusedElement instanceof HTMLButtonElement) || focusedElement.disabled) return false;
  focusedElement.click();
  return true;
}

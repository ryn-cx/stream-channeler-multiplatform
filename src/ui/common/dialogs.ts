// TODO: Validate
import { clickFocusedElement, moveFocusAmong, type RemoteAction, type RemoteInput } from "./remote-input";
import { actionButton, textLabel } from "./ui";

export interface DialogButton {
  label: string;
  onChosen?: () => void;
  closesDialog?: boolean;
}

export interface DialogOptions {
  title: string;
  message?: string;
  contentElements?: HTMLElement[];
  menuItems?: DialogButton[];
  buttons: DialogButton[];
  onCancelled?: () => void;
}

export interface OpenDialog {
  close(): void;
  setTitle(titleText: string): void;
  buttonElements: HTMLButtonElement[];
}

// TODO: Validate
export function showDialog(remoteInput: RemoteInput, dialogOptions: DialogOptions): OpenDialog {
  const previouslyFocusedElement = document.activeElement as HTMLElement | null;
  const dialogBackdrop = document.createElement("div");
  dialogBackdrop.className = "dialog-backdrop";
  const dialogPanel = document.createElement("div");
  dialogPanel.className = "dialog-panel";
  dialogPanel.setAttribute("role", "dialog");
  dialogPanel.setAttribute("aria-modal", "true");
  const dialogTitle = textLabel(dialogOptions.title, "dialog-title");
  dialogPanel.append(dialogTitle);
  if (dialogOptions.message !== undefined) dialogPanel.append(textLabel(dialogOptions.message, "dialog-message"));
  for (const contentElement of dialogOptions.contentElements ?? []) dialogPanel.append(contentElement);

  let isClosed = false;
  const dialogHandler = {
    // TODO: Validate
    handleRemoteAction(remoteAction: RemoteAction): boolean {
      switch (remoteAction) {
        case "up":
        case "left":
          moveFocusAmong(focusableElements(), -1);
          return true;
        case "down":
        case "right":
          moveFocusAmong(focusableElements(), 1);
          return true;
        case "select":
          if (!clickFocusedElement()) moveFocusAmong(focusableElements(), 1);
          return true;
        case "back":
          closeDialog();
          dialogOptions.onCancelled?.();
          return true;
        default:
          return true;
      }
    },
  };

  // TODO: Validate
  function closeDialog(): void {
    if (isClosed) return;
    isClosed = true;
    remoteInput.removeHandler(dialogHandler);
    dialogBackdrop.remove();
    if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
  }

  // TODO: Validate
  function dialogButtonElement(dialogButton: DialogButton, className: string): HTMLButtonElement {
    return actionButton(
      dialogButton.label,
      () => {
        if (dialogButton.closesDialog !== false) closeDialog();
        dialogButton.onChosen?.();
      },
      className,
    );
  }

  const menuItemElements = (dialogOptions.menuItems ?? []).map((menuItem) =>
    dialogButtonElement(menuItem, "dialog-menu-item"),
  );
  if (menuItemElements.length > 0) {
    const dialogMenu = document.createElement("div");
    dialogMenu.className = "dialog-menu";
    dialogMenu.append(...menuItemElements);
    dialogPanel.append(dialogMenu);
  }
  const buttonElements = dialogOptions.buttons.map((dialogButton) =>
    dialogButtonElement(dialogButton, "dialog-button"),
  );
  const dialogButtonRow = document.createElement("div");
  dialogButtonRow.className = "dialog-button-row";
  dialogButtonRow.append(...buttonElements);
  dialogPanel.append(dialogButtonRow);

  // TODO: Validate
  function focusableElements(): HTMLElement[] {
    return [...dialogPanel.querySelectorAll<HTMLElement>("input, button")];
  }

  dialogBackdrop.append(dialogPanel);
  dialogBackdrop.addEventListener("click", (clickEvent) => {
    if (clickEvent.target !== dialogBackdrop) return;
    closeDialog();
    dialogOptions.onCancelled?.();
  });
  document.body.append(dialogBackdrop);
  remoteInput.pushHandler(dialogHandler);
  focusableElements()[0]?.focus();
  return {
    close: closeDialog,
    setTitle: (titleText) => {
      dialogTitle.textContent = titleText;
    },
    buttonElements,
  };
}

// TODO: Validate
export function showActionMenu(
  remoteInput: RemoteInput,
  menuTitle: string,
  menuItems: { label: string; action: () => void }[],
): OpenDialog {
  return showDialog(remoteInput, {
    title: menuTitle,
    menuItems: menuItems.map((menuItem) => ({ label: menuItem.label, onChosen: menuItem.action })),
    buttons: [{ label: "Cancel" }],
  });
}

// TODO: Validate
export function showErrorPopup(remoteInput: RemoteInput, errorMessage: string): OpenDialog {
  return showDialog(remoteInput, { title: "Something went wrong", message: errorMessage, buttons: [{ label: "OK" }] });
}

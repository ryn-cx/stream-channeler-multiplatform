// TODO: Validate
import type { RemoteActionHandler } from "./remote-input";

export interface AppView extends RemoteActionHandler {
  readonly rootElement: HTMLElement;
  onShown(): void;
  onHidden(): void;
}

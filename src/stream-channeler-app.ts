// TODO: Validate
import { AccountSettingsRepository } from "./data/account-settings-repository";
import { GuideRepository } from "./data/guide-repository";
import { LocalAppStorage } from "./data/local-app-storage";
import { StreamChannelerApi } from "./data/stream-channeler-api";
import { stopMonitoring } from "./playback/video-player";
import type { AppView } from "./ui/common/app-view";
import { ImageLoader } from "./ui/common/image-loader";
import { RemoteInput } from "./ui/common/remote-input";
import { applyZoom } from "./ui/common/ui";
import { GuideView } from "./ui/guide/guide-view";
import { LoginView } from "./ui/login/login-view";
import { SettingsView } from "./ui/settings/settings-view";

// TODO: Validate
export class StreamChannelerApp {
  readonly preferences: LocalAppStorage;
  readonly api: StreamChannelerApi;
  readonly accountSettings: AccountSettingsRepository;
  readonly guideRepository: GuideRepository;
  readonly imageLoader = new ImageLoader();
  readonly remoteInput = new RemoteInput();
  private readonly appRoot: HTMLElement;
  private readonly shownViews: AppView[] = [];

  // TODO: Validate
  private constructor(appRoot: HTMLElement, preferences: LocalAppStorage) {
    this.appRoot = appRoot;
    this.preferences = preferences;
    this.api = new StreamChannelerApi(() => this.preferences.accessToken);
    this.accountSettings = new AccountSettingsRepository(this.api, this.preferences);
    this.guideRepository = new GuideRepository(this.api, this.preferences, this.accountSettings);
  }

  // TODO: Validate
  static async create(appRoot: HTMLElement): Promise<StreamChannelerApp> {
    return new StreamChannelerApp(appRoot, await LocalAppStorage.load());
  }

  // TODO: Validate
  start(): void {
    applyZoom(this.preferences.zoomPercent);
    if (this.preferences.hasFinishedLogin) {
      this.showGuide();
    } else {
      this.showLogin();
    }
  }

  // TODO: Validate
  showLogin(): void {
    this.replaceAllViews(new LoginView(this));
  }

  // TODO: Validate
  showGuide(): void {
    this.replaceAllViews(new GuideView(this));
  }

  // TODO: Validate
  openSettings(): void {
    this.pushView(new SettingsView(this));
  }

  // TODO: Validate
  closeTopView(): void {
    if (this.shownViews.length <= 1) return;
    const closedView = this.shownViews.pop();
    if (closedView === undefined) return;
    closedView.onHidden();
    this.remoteInput.removeHandler(closedView);
    closedView.rootElement.remove();
    const revealedView = this.shownViews[this.shownViews.length - 1];
    if (revealedView === undefined) return;
    revealedView.rootElement.hidden = false;
    revealedView.onShown();
  }

  // TODO: Validate
  signOutAndShowLogin(): void {
    if (this.preferences.isSignedIn) {
      void stopMonitoring(this.preferences);
      this.signOutOfDeviceAndForgetAccount();
      this.guideRepository.clearForAccountChange();
    }
    this.showLogin();
  }

  // TODO: Validate
  signOutOfDeviceAndForgetAccount(): void {
    const signedOutAccessToken = this.preferences.accessToken;
    this.preferences.signOut();
    if (signedOutAccessToken === null || signedOutAccessToken.length === 0) return;
    this.api.signOutDevice(signedOutAccessToken).catch((signOutError: unknown) => {
      console.warn("Couldn't sign this device out on the server", signOutError);
    });
  }

  // TODO: Validate
  private pushView(pushedView: AppView): void {
    const coveredView = this.shownViews[this.shownViews.length - 1];
    if (coveredView !== undefined) {
      coveredView.onHidden();
      coveredView.rootElement.hidden = true;
    }
    this.shownViews.push(pushedView);
    this.appRoot.append(pushedView.rootElement);
    this.remoteInput.pushHandler(pushedView);
    pushedView.onShown();
  }

  // TODO: Validate
  private replaceAllViews(replacementView: AppView): void {
    for (const replacedView of this.shownViews.splice(0)) {
      replacedView.onHidden();
      this.remoteInput.removeHandler(replacedView);
      replacedView.rootElement.remove();
    }
    this.pushView(replacementView);
  }
}

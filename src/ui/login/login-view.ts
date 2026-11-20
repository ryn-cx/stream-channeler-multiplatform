// TODO: Validate

import { describeLoadError, errorMessage } from "../../data/load-errors";
import type { DeviceSignInCode } from "../../data/models";
import { ApiException } from "../../data/stream-channeler-api";
import type { StreamChannelerApp } from "../../stream-channeler-app";
import { LOGO_URL } from "../../userscript/userscript-pages";
import type { AppView } from "../common/app-view";
import { clickFocusedElement, moveFocusAmong, type RemoteAction } from "../common/remote-input";
import { actionButton, setShown, textInput, textLabel } from "../common/ui";

// TODO: Validate
function wait(waited: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, waited));
}

// TODO: Validate
export class LoginView implements AppView {
  readonly rootElement: HTMLElement;
  private readonly app: StreamChannelerApp;
  private readonly codeSignInButton: HTMLButtonElement;
  private readonly codeSignInInstructionsText: HTMLDivElement;
  private readonly verificationLink: HTMLAnchorElement;
  private readonly userCodeText: HTMLDivElement;
  private readonly usernameInput: HTMLInputElement;
  private readonly passwordInput: HTMLInputElement;
  private readonly signInButton: HTMLButtonElement;
  private readonly continueAnonymouslyButton: HTMLButtonElement;
  private readonly statusMessageText: HTMLDivElement;
  private isSigningIn = false;
  private currentCodeSignInAttempt = 0;
  private isShown = false;

  // TODO: Validate
  constructor(app: StreamChannelerApp) {
    this.app = app;
    this.rootElement = document.createElement("div");
    this.rootElement.className = "login-screen";
    const logoImage = document.createElement("img");
    logoImage.className = "login-logo";
    logoImage.src = LOGO_URL;
    logoImage.alt = "";
    this.codeSignInButton = actionButton("Sign in with a code", () => this.startCodeSignIn());
    this.codeSignInInstructionsText = textLabel("", "login-code-instructions");
    this.verificationLink = document.createElement("a");
    this.verificationLink.className = "login-verification-link";
    this.verificationLink.target = "_blank";
    this.verificationLink.rel = "noopener";
    this.userCodeText = textLabel("", "login-user-code");
    this.usernameInput = textInput("Email", "email");
    this.passwordInput = textInput("Password", "password");
    this.signInButton = actionButton("Sign in", () => this.signIn());
    this.continueAnonymouslyButton = actionButton("Continue without signing in", () => this.continueAnonymously());
    this.statusMessageText = textLabel("", "login-status");
    setShown(this.codeSignInInstructionsText, false);
    setShown(this.verificationLink, false);
    setShown(this.userCodeText, false);
    setShown(this.statusMessageText, false);
    const loginForm = document.createElement("div");
    loginForm.className = "login-form";
    loginForm.append(
      logoImage,
      textLabel("Stream Channeler", "login-title"),
      textLabel(
        "Sign in to see your favorite and owned channels, or watch public channels without an account.",
        "login-subtitle",
      ),
      this.codeSignInButton,
      this.codeSignInInstructionsText,
      this.verificationLink,
      this.userCodeText,
      textLabel("Or sign in with your email and password", "login-password-heading"),
      this.usernameInput,
      this.passwordInput,
      this.signInButton,
      this.continueAnonymouslyButton,
      this.statusMessageText,
    );
    this.rootElement.append(loginForm);
  }

  // TODO: Validate
  onShown(): void {
    this.isShown = true;
    this.codeSignInButton.focus();
  }

  // TODO: Validate
  onHidden(): void {
    this.isShown = false;
    this.currentCodeSignInAttempt++;
  }

  // TODO: Validate
  handleRemoteAction(remoteAction: RemoteAction): boolean {
    const focusableElements = [
      this.codeSignInButton,
      this.verificationLink,
      this.usernameInput,
      this.passwordInput,
      this.signInButton,
      this.continueAnonymouslyButton,
    ];
    switch (remoteAction) {
      case "up":
        return moveFocusAmong(focusableElements, -1);
      case "down":
        return moveFocusAmong(focusableElements, 1);
      case "select":
        if (document.activeElement === this.passwordInput) {
          this.signIn();
          return true;
        }
        if (document.activeElement === this.usernameInput) return moveFocusAmong(focusableElements, 1);
        if (document.activeElement === this.verificationLink) {
          this.verificationLink.click();
          return true;
        }
        return clickFocusedElement();
      default:
        return false;
    }
  }

  // TODO: Validate
  private signIn(): void {
    if (this.isSigningIn) return;
    const enteredUsername = this.usernameInput.value.trim();
    const enteredPassword = this.passwordInput.value;
    if (enteredUsername.length === 0 || enteredPassword.length === 0) {
      this.showStatusMessage("Enter your email and password.", true);
      return;
    }
    this.cancelCodeSignIn();
    this.setSigningIn(true);
    this.showStatusMessage("Signing in…", false);
    void (async () => {
      try {
        const accessToken = await this.app.api.logIn(enteredUsername, enteredPassword);
        const signedInDisplayName = (await this.saveAccessTokenAndReadDisplayName(accessToken)) ?? enteredUsername;
        if (!this.isShown) return;
        this.setSigningIn(false);
        this.finishSignIn(signedInDisplayName);
      } catch (signInError) {
        this.app.preferences.accessToken = null;
        if (!this.isShown) return;
        this.setSigningIn(false);
        this.showStatusMessage(errorMessage(signInError) || "Couldn't sign in.", true);
      }
    })();
  }

  // TODO: Validate
  private startCodeSignIn(): void {
    const codeSignInAttempt = ++this.currentCodeSignInAttempt;
    setShown(this.statusMessageText, false);
    this.codeSignInInstructionsText.textContent = "Getting a code…";
    setShown(this.codeSignInInstructionsText, true);
    setShown(this.verificationLink, false);
    setShown(this.userCodeText, false);
    void (async () => {
      let deviceSignInCode: DeviceSignInCode;
      try {
        deviceSignInCode = await this.app.api.requestDeviceSignInCode();
      } catch (codeRequestError) {
        this.showCodeSignInFailure(
          codeSignInAttempt,
          `Couldn't get a sign-in code: ${describeLoadError(codeRequestError)}.`,
        );
        return;
      }
      if (codeSignInAttempt !== this.currentCodeSignInAttempt || !this.isShown) return;
      this.showSignInCode(deviceSignInCode);
      let signedInDisplayName: string | null | undefined;
      try {
        signedInDisplayName = await this.waitForCodeToBeEntered(deviceSignInCode, codeSignInAttempt);
      } catch (codeCheckError) {
        this.showCodeSignInFailure(
          codeSignInAttempt,
          `Signing in with the code didn't finish: ${describeLoadError(codeCheckError)}. Get a new code to try again.`,
        );
        return;
      }
      if (signedInDisplayName === undefined || codeSignInAttempt !== this.currentCodeSignInAttempt || !this.isShown) {
        return;
      }
      this.finishSignIn(signedInDisplayName);
    })();
  }

  // TODO: Validate
  private async waitForCodeToBeEntered(
    deviceSignInCode: DeviceSignInCode,
    codeSignInAttempt: number,
  ): Promise<string | null | undefined> {
    const codeExpiresAt = performance.now() + deviceSignInCode.expiresInSeconds * 1000;
    while (performance.now() < codeExpiresAt) {
      await wait(deviceSignInCode.pollIntervalSeconds * 1000);
      if (codeSignInAttempt !== this.currentCodeSignInAttempt) return undefined;
      let accessToken: string | null = null;
      try {
        accessToken = await this.app.api.exchangeDeviceSignInCode(deviceSignInCode.deviceCode);
      } catch (codeCheckError) {
        if (
          codeCheckError instanceof ApiException &&
          codeCheckError.statusCode >= 400 &&
          codeCheckError.statusCode < 500
        ) {
          throw codeCheckError;
        }
      }
      if (accessToken === null) continue;
      if (codeSignInAttempt !== this.currentCodeSignInAttempt) return undefined;
      return this.saveAccessTokenAndReadDisplayName(accessToken);
    }
    this.showCodeSignInFailure(codeSignInAttempt, "The code expired. Select Sign in with a code to get a new one.");
    return undefined;
  }

  // TODO: Validate
  private showSignInCode(deviceSignInCode: DeviceSignInCode): void {
    const verificationAddress = deviceSignInCode.verificationUri.replace(/^https?:\/\//, "");
    this.codeSignInInstructionsText.textContent = "On your phone or computer, go to this address and enter this code:";
    this.verificationLink.href = deviceSignInCode.verificationUri;
    this.verificationLink.textContent = verificationAddress;
    this.userCodeText.textContent = deviceSignInCode.userCode;
    setShown(this.verificationLink, true);
    setShown(this.userCodeText, true);
    this.codeSignInButton.textContent = "Get a new code";
  }

  // TODO: Validate
  private showCodeSignInFailure(codeSignInAttempt: number, failureMessage: string): void {
    if (!this.isShown || codeSignInAttempt !== this.currentCodeSignInAttempt) return;
    this.hideSignInCode();
    this.showStatusMessage(failureMessage, true);
  }

  // TODO: Validate
  private cancelCodeSignIn(): void {
    this.currentCodeSignInAttempt++;
    this.hideSignInCode();
  }

  // TODO: Validate
  private hideSignInCode(): void {
    setShown(this.codeSignInInstructionsText, false);
    setShown(this.verificationLink, false);
    setShown(this.userCodeText, false);
    this.codeSignInButton.textContent = "Sign in with a code";
  }

  // TODO: Validate
  private async saveAccessTokenAndReadDisplayName(accessToken: string): Promise<string | null> {
    this.app.preferences.accessToken = accessToken;
    try {
      const signedInUser = await this.app.api.fetchSignedInUser();
      this.app.preferences.saveSignedInUser(signedInUser);
      return signedInUser.username;
    } catch {
      return null;
    }
  }

  // TODO: Validate
  private finishSignIn(signedInDisplayName: string | null): void {
    this.app.preferences.signedInDisplayName = signedInDisplayName;
    this.app.preferences.hasChosenAnonymous = false;
    this.app.guideRepository.clearForAccountChange();
    this.app.showGuide();
  }

  // TODO: Validate
  private continueAnonymously(): void {
    this.cancelCodeSignIn();
    const wasSignedIn = this.app.preferences.isSignedIn;
    this.app.signOutOfDeviceAndForgetAccount();
    this.app.preferences.hasChosenAnonymous = true;
    if (wasSignedIn) this.app.guideRepository.clearForAccountChange();
    this.app.showGuide();
  }

  // TODO: Validate
  private setSigningIn(isSigningIn: boolean): void {
    this.isSigningIn = isSigningIn;
    for (const formControl of [
      this.codeSignInButton,
      this.signInButton,
      this.continueAnonymouslyButton,
      this.usernameInput,
      this.passwordInput,
    ]) {
      formControl.disabled = isSigningIn;
    }
  }

  // TODO: Validate
  private showStatusMessage(messageText: string, isError: boolean): void {
    this.statusMessageText.textContent = messageText;
    this.statusMessageText.classList.toggle("is-error", isError);
    setShown(this.statusMessageText, true);
  }
}

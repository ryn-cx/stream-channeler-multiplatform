// TODO: Validate
import { errorMessage } from "./load-errors";
import type { LocalAppStorage } from "./local-app-storage";
import type { ChannelRefreshSettings } from "./models";
import type { StreamChannelerApi } from "./stream-channeler-api";
import { SerialTaskQueue } from "./task-queues";

// TODO: Validate
export class AccountSettingsRepository {
  private readonly api: StreamChannelerApi;
  private readonly preferences: LocalAppStorage;
  private readonly accountSettingsQueue = new SerialTaskQueue();

  // TODO: Validate
  constructor(api: StreamChannelerApi, preferences: LocalAppStorage) {
    this.api = api;
    this.preferences = preferences;
  }

  // TODO: Validate
  async loadSignedInUserIfReachable(): Promise<void> {
    try {
      this.preferences.saveSignedInUser(await this.api.fetchSignedInUser());
    } catch (signedInUserError) {
      console.warn("Couldn't load the account's refresh settings", signedInUserError);
    }
  }

  // TODO: Validate
  refreshUserSettings(onSuccess: () => void, onFailure: (failureMessage: string) => void): void {
    void this.accountSettingsQueue.run(async () => {
      try {
        this.preferences.saveSignedInUser(await this.api.fetchSignedInUser());
        onSuccess();
      } catch (userSettingsError) {
        console.warn("Couldn't refresh the user settings", userSettingsError);
        onFailure(`Couldn't refresh the user settings: ${errorMessage(userSettingsError)}`);
      }
    });
  }

  // TODO: Validate
  updateAccountStreamingProfile(
    pluginKey: string,
    profileName: string | null,
    profilePin: string | null,
    onSaved: () => void,
    onFailure: (failureMessage: string) => void,
  ): void {
    void this.accountSettingsQueue.run(async () => {
      try {
        this.preferences.replaceAccountStreamingProfiles(
          await this.api.updatePluginProfile(pluginKey, profileName, profilePin),
        );
        onSaved();
      } catch (profileError) {
        console.warn(`Couldn't save the ${pluginKey} profile`, profileError);
        onFailure(`Couldn't save the ${pluginKey} profile: ${errorMessage(profileError)}`);
      }
    });
  }

  // TODO: Validate
  updateChannelRefreshSettings(
    channelId: string,
    channelRefreshSettings: ChannelRefreshSettings,
    onSaved: () => void,
    onFailure: (failureMessage: string) => void,
  ): void {
    void this.accountSettingsQueue.run(async () => {
      try {
        await this.api.updateChannelRefreshSettings(channelId, channelRefreshSettings);
        this.preferences.replaceAccountChannelRefreshSettings(channelId, channelRefreshSettings);
        onSaved();
      } catch (settingError) {
        console.warn(`Couldn't save ${channelId}'s refresh settings`, settingError);
        onFailure(`Couldn't save the channel's settings: ${errorMessage(settingError)}`);
      }
    });
  }
}

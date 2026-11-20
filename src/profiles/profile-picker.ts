// TODO: Validate
import { readGmValue, writeGmValue } from "../userscript/gm-values";

const PROFILE_PICKER_VALUE_KEY = "profilePicker";

export type ProfilePickerProgress = "profile-picked" | "disarmed";

export interface ProfilePickerArmedState {
  armedUntil: number;
  hasPickedProfile: boolean;
  isDisarmed: boolean;
}

export interface ProfilePickerSetup {
  armedUntil: number;
  wantedProfileName: string;
  profilePin: string;
  hasPickedProfile: boolean;
  /** The address of the video the picker was armed for, or null when the video has no address. */
  videoUrl: string | null;
}

// TODO: Validate
export async function armProfilePicker(): Promise<void> {
  const profilePickerArmedState: ProfilePickerArmedState = {
    armedUntil: Date.now() + 30_000,
    hasPickedProfile: false,
    isDisarmed: false,
  };
  await writeGmValue(PROFILE_PICKER_VALUE_KEY, profilePickerArmedState);
}

// TODO: Validate
export async function readProfilePickerArmedState(): Promise<ProfilePickerArmedState | null> {
  return (await readGmValue<ProfilePickerArmedState>(PROFILE_PICKER_VALUE_KEY)) ?? null;
}

// TODO: Validate
export async function recordProfilePickerProgress(profilePickerProgress: ProfilePickerProgress): Promise<void> {
  const profilePickerArmedState = await readProfilePickerArmedState();
  if (profilePickerArmedState === null) return;
  const progressedArmedState: ProfilePickerArmedState = {
    ...profilePickerArmedState,
    hasPickedProfile: profilePickerArmedState.hasPickedProfile || profilePickerProgress === "profile-picked",
    isDisarmed: profilePickerArmedState.isDisarmed || profilePickerProgress === "disarmed",
  };
  await writeGmValue(PROFILE_PICKER_VALUE_KEY, progressedArmedState);
}

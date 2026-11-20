// TODO: Validate
import type { PlayerButtonField, StreamingSite } from "./streaming-site";

/** What a kind of player button is used for. It is the same on every site. */
export interface PlayerButtonKind {
  /** The button's name as the viewer sees it, such as "Skip Intro". */
  label: string;
  /** Whether the viewer can turn on clicking the button. */
  canBeClicked: boolean;
  /** Whether the button appearing can be one of the moments that play the next episode. */
  canPlayNextEpisode: boolean;
}

export const PLAYER_BUTTON_KINDS: Record<PlayerButtonField, PlayerButtonKind> = {
  skipIntroButton: { label: "Skip Intro", canBeClicked: true, canPlayNextEpisode: false },
  skipRecapButton: { label: "Skip Recap", canBeClicked: true, canPlayNextEpisode: false },
  skipCreditsButton: { label: "Skip Credits", canBeClicked: true, canPlayNextEpisode: true },
  skipPreviewButton: { label: "Skip Preview", canBeClicked: true, canPlayNextEpisode: false },
  // Stream Channeler plays the next guide video itself, so the site's own next episode button is never clicked.
  nextEpisodeButton: { label: "Next Episode", canBeClicked: false, canPlayNextEpisode: true },
};

export const PLAYER_BUTTON_FIELDS_IN_ORDER: PlayerButtonField[] = [
  "skipIntroButton",
  "skipRecapButton",
  "skipCreditsButton",
  "skipPreviewButton",
  "nextEpisodeButton",
];

/** A player button appearing, or the episode ending. */
export type PlayNextEpisodeWhen = PlayerButtonField | "Episode ends";

export interface StreamingSiteSettings {
  /** The moments the viewer checked. The site's last moment is always on as well, and is not saved here. */
  checkedPlayNextEpisodeMoments: PlayNextEpisodeWhen[];
  clickedPlayerButtons: PlayerButtonField[];
  silencesAds: boolean;
}

export const DEFAULT_STREAMING_SITE_SETTINGS: StreamingSiteSettings = {
  checkedPlayNextEpisodeMoments: [],
  clickedPlayerButtons: [],
  silencesAds: true,
};

export const PLAY_NEXT_EPISODE_MOMENTS_IN_ORDER: PlayNextEpisodeWhen[] = [
  ...PLAYER_BUTTON_FIELDS_IN_ORDER.filter(
    (playerButtonField) => PLAYER_BUTTON_KINDS[playerButtonField].canPlayNextEpisode,
  ),
  "Episode ends",
];

// TODO: Validate
export function playNextEpisodeWhenLabel(playNextEpisodeMoment: PlayNextEpisodeWhen): string {
  return playNextEpisodeMoment === "Episode ends"
    ? "The episode ends"
    : `The ${PLAYER_BUTTON_KINDS[playNextEpisodeMoment].label} button appears`;
}

// TODO: Validate
/** Returns the moments at which streamingSite can play the next episode, in the order they happen. */
export function playNextEpisodeWhenChoices(streamingSite: StreamingSite): PlayNextEpisodeWhen[] {
  return PLAY_NEXT_EPISODE_MOMENTS_IN_ORDER.filter((playNextEpisodeMoment) =>
    streamingSiteHasMoment(streamingSite, playNextEpisodeMoment),
  );
}

// TODO: Validate
function streamingSiteHasMoment(streamingSite: StreamingSite, playNextEpisodeMoment: PlayNextEpisodeWhen): boolean {
  if (playNextEpisodeMoment === "Episode ends") return true;
  return streamingSite[playNextEpisodeMoment] !== undefined;
}

/** The moment that is always on and cannot be unchecked, so that every video ends through the site's end rule. */
export const ALWAYS_ON_PLAY_NEXT_EPISODE_MOMENT: PlayNextEpisodeWhen = "Episode ends";

// TODO: Validate
/** Returns the moments that play the next episode on streamingSite: the checked ones it has, and its always-on one. */
export function activePlayNextEpisodeMoments(
  streamingSite: StreamingSite,
  checkedPlayNextEpisodeMoments: PlayNextEpisodeWhen[],
): PlayNextEpisodeWhen[] {
  return playNextEpisodeWhenChoices(streamingSite).filter(
    (playNextEpisodeMoment) =>
      playNextEpisodeMoment === ALWAYS_ON_PLAY_NEXT_EPISODE_MOMENT ||
      checkedPlayNextEpisodeMoments.includes(playNextEpisodeMoment),
  );
}

/** An on or off setting on a website's tab, such as clicking the Skip Intro button. */
export interface StreamingSiteToggleSetting {
  label: string;
  isSupportedBy: (streamingSite: StreamingSite) => boolean;
  isOnIn: (streamingSiteSettings: StreamingSiteSettings) => boolean;
  /** Returns the settings change that turns the toggle on or off and keeps the site's other settings as they are. */
  settingsChange: (streamingSiteSettings: StreamingSiteSettings, isTurnedOn: boolean) => Partial<StreamingSiteSettings>;
}

// TODO: Validate
export const STREAMING_SITE_TOGGLE_SETTINGS: StreamingSiteToggleSetting[] = [
  ...PLAYER_BUTTON_FIELDS_IN_ORDER.filter(
    (playerButtonField) => PLAYER_BUTTON_KINDS[playerButtonField].canBeClicked,
  ).map(
    (clickablePlayerButtonField): StreamingSiteToggleSetting => ({
      label: `Click the ${PLAYER_BUTTON_KINDS[clickablePlayerButtonField].label} button`,
      isSupportedBy: (streamingSite) => streamingSite[clickablePlayerButtonField] !== undefined,
      isOnIn: (streamingSiteSettings) =>
        streamingSiteSettings.clickedPlayerButtons.includes(clickablePlayerButtonField),
      settingsChange: (streamingSiteSettings, isTurnedOn) => {
        const otherClickedPlayerButtons = streamingSiteSettings.clickedPlayerButtons.filter(
          (clickedPlayerButtonField) => clickedPlayerButtonField !== clickablePlayerButtonField,
        );
        return {
          clickedPlayerButtons: isTurnedOn
            ? [...otherClickedPlayerButtons, clickablePlayerButtonField]
            : otherClickedPlayerButtons,
        };
      },
    }),
  ),
  {
    label: "Silence ads",
    isSupportedBy: (streamingSite) => streamingSite.createAdMarker !== undefined,
    isOnIn: (streamingSiteSettings) => streamingSiteSettings.silencesAds,
    settingsChange: (_streamingSiteSettings, isTurnedOn) => ({ silencesAds: isTurnedOn }),
  },
];

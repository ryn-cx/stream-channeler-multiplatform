<!-- TODO: Validate -->
# End rule tier list

Each streaming site has exactly one end signal in `src/streamingsites/<site>.ts`: `playbackEndRule`, or a `nextEpisodeButton`
when a next episode button is the only sign of the end. Pick it from a real
recording of the site's episode end. Never stack rules "to be safe".

To choose a site's rule, read its recording and go down this list. Use the highest tier whose signal the recording
shows at the real end of the episode, and only at the end.

## S tier: the video's `ended` event

`BrowserMediaEndedEndsVideo`

- It is the browser's own signal, so it does not depend on selectors, address patterns or wording that a site redesign
  can break.
- It fires at the moment the video finishes.
- It fails on sites that move to the next episode before the video ends, or that never let the video reach its end.
  The recording shows whether `ended` fires.

## A tier: the episode's address changes

`EpisodeAddressChangeEndsVideo(<episode id pattern>)`

- Autoplay loads the next episode at a new address, and the pattern pulls the episode ID out of it.
- It depends only on the site's address scheme, which changes rarely.
- It needs autoplay to be on. The pattern must match only the episode ID, so that query or tracking changes do not
  count as a new episode.

## B tier: the video's media ID changes

`MediaIdChangeEndsVideo`

- Use it for sites that keep the same address and swap the video source for the next episode, such as Prime Video.

## C tier: an element on the screen

`OnScreenElementEndsVideo(<finder>)`, such as Disney+'s play next views

- Use it only when the recording shows no browser or address signal, and the site's next-episode card or button is the
  only sign of the end.
- CSS selectors and button text break when the site is redesigned or shown in another language. Back the selector with
  a saved copy of the page.

## Not allowed

These were removed because they guessed at the end instead of reading a signal the site gives:

- Ending when the position reaches the reported duration or the guide length.
- Ending when the media session title changes.
- Ending when playback stops for a few seconds.
- Ending when the page starts another video player.
- A stack of several of these together.

## Playing the next episode earlier is a setting

Each website's tab in the settings has a checklist of the moments that play the next episode. Any checked moment
plays it, whichever comes first.

- **The Skip Credits button appears** is offered on sites with a `skipCreditsButton`. It uses the same finder as the
  Skip Credits clicker.
- **The next episode button appears** is offered on sites with a `nextEpisodeButton`.
- **The episode ends** is offered on sites with `playbackEndRule`.
- A site's last moment is always on and cannot be unchecked, so every video ends even when no checked moment comes.

## Current sites

"Recording with playback" means that a recording of the site exists in which the video plays. It does not say that
someone checked the rule against that recording. Recordings and saved pages are kept locally and are not part of the
repository, because they contain account details and copyrighted page content.

| Site | Rule | Tier | Recording with playback |
| --- | --- | --- | --- |
| YouTube | Video `ended` | S | Yes |
| NHK World | Video `ended` | S | Yes |
| Crunchyroll | Video `ended` | S | No. Both recordings stopped at the Cloudflare check before the video played. |
| HIDIVE | Video `ended` | S | No. The recording never reached a playing video. |
| Internet Archive | Video `ended` | S | No recording. |
| Hulu | Address change | A | Yes |
| Netflix | Address change | A | Yes |
| HBO Max | Address change | A | Yes |
| Paramount+ | Address change | A | Yes |
| PBS | Address change | A | Yes |
| Peacock | Address change | A | Yes |
| The Roku Channel | Address change | A | Yes, recorded on app.roku.com. The therokuchannel.roku.com recording never played. |
| Tubi | Address change | A | Yes |
| Prime Video | Media ID change | B | Yes |
| Pluto TV | Episode end card on screen | C | No. The rule is based on a saved copy of the end card. |
| Disney+ | Up Next tray tile on screen | C | No recording. The rule is based on saved copies of the pages. |

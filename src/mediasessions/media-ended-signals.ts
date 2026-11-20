// TODO: Validate
import type { EndedMedia } from "../playback/playback-end-detector";

const mediaListenedToForEnded = new WeakSet<HTMLMediaElement>();
let lastEndedMediaInThisFrame: EndedMedia | null = null;

// TODO: Validate
function recordEndedMedia(endedEvent: Event): void {
  const endedMediaElement = endedEvent.currentTarget;
  if (!(endedMediaElement instanceof HTMLMediaElement)) return;
  const endedMediaDurationSeconds = endedMediaElement.duration;
  lastEndedMediaInThisFrame = {
    endedAt: Date.now(),
    duration:
      Number.isFinite(endedMediaDurationSeconds) && endedMediaDurationSeconds > 0
        ? Math.floor(endedMediaDurationSeconds * 1000)
        : null,
  };
}

// TODO: Validate
export function listenForMediaEnded(mediaElements: HTMLMediaElement[]): void {
  for (const mediaElement of mediaElements) {
    if (mediaListenedToForEnded.has(mediaElement)) continue;
    mediaListenedToForEnded.add(mediaElement);
    mediaElement.addEventListener("ended", recordEndedMedia);
  }
}

// TODO: Validate
export function lastEndedMediaSignal(): EndedMedia | null {
  return lastEndedMediaInThisFrame;
}

// TODO: Validate
import type { EndedMedia, MediaObservation } from "../playback/playback-end-detector";
import { SkipButtonClicker } from "../playback/skip-button-clicker";
import { streamingSiteForHost } from "../streamingsites/streaming-site";
import { lastEndedMediaSignal, listenForMediaEnded } from "./media-ended-signals";
import { findEveryVideo, findMainVideo, observeVideo, pauseEveryVideo } from "./video-observation";

const FRAME_MESSAGE_SOURCE = "stream-channeler";

export type MessageToChildFrame =
  | { source: typeof FRAME_MESSAGE_SOURCE; type: "observe-video" }
  | { source: typeof FRAME_MESSAGE_SOURCE; type: "pause-video" }
  | { source: typeof FRAME_MESSAGE_SOURCE; type: "click-play-button" };

export interface VideoObservationFromFrame {
  source: typeof FRAME_MESSAGE_SOURCE;
  type: "video-observation";
  observation: MediaObservation | null;
  lastEndedMedia: EndedMedia | null;
}

// TODO: Validate
function isFrameMessage(messageData: unknown): messageData is { source: string; type: string } {
  return (
    typeof messageData === "object" &&
    messageData !== null &&
    (messageData as { source?: unknown }).source === FRAME_MESSAGE_SOURCE &&
    typeof (messageData as { type?: unknown }).type === "string"
  );
}

// TODO: Validate
function isMessageToChildFrame(messageData: unknown): messageData is MessageToChildFrame {
  return (
    isFrameMessage(messageData) &&
    (messageData.type === "observe-video" ||
      messageData.type === "pause-video" ||
      messageData.type === "click-play-button")
  );
}

// TODO: Validate
export function isVideoObservationFromFrame(messageData: unknown): messageData is VideoObservationFromFrame {
  return isFrameMessage(messageData) && messageData.type === "video-observation";
}

// TODO: Validate
function postToChildFrames(messageToChildFrame: MessageToChildFrame): void {
  for (let childFrameIndex = 0; childFrameIndex < window.frames.length; childFrameIndex++) {
    window.frames[childFrameIndex]?.postMessage(messageToChildFrame, "*");
  }
}

// TODO: Validate
export function askChildFramesToObserveVideo(): void {
  postToChildFrames({ source: FRAME_MESSAGE_SOURCE, type: "observe-video" });
}

// TODO: Validate
export function askChildFramesToPauseVideo(): void {
  postToChildFrames({ source: FRAME_MESSAGE_SOURCE, type: "pause-video" });
}

// TODO: Validate
/** Asks every child frame to click its site's play button, for sites whose player sits in a frame, such as PBS. */
export function askChildFramesToClickPlayButton(): void {
  postToChildFrames({ source: FRAME_MESSAGE_SOURCE, type: "click-play-button" });
}

// TODO: Validate
export function startAnsweringTopFrame(): void {
  const frameSite = streamingSiteForHost(window.location.hostname);
  const framePlayButtonClicker =
    frameSite?.findPlayButton === undefined ? null : new SkipButtonClicker(frameSite.findPlayButton);
  window.addEventListener("message", (messageEvent) => {
    if (messageEvent.source !== window.parent || !isMessageToChildFrame(messageEvent.data)) return;
    postToChildFrames(messageEvent.data);
    if (messageEvent.data.type === "pause-video") {
      pauseEveryVideo(document);
      return;
    }
    if (messageEvent.data.type === "click-play-button") {
      if (framePlayButtonClicker?.clickWhenShowing(Date.now()) === true) {
        console.info(`Clicked the Play button in the ${window.location.hostname} frame`);
      }
      return;
    }
    listenForMediaEnded(findEveryVideo(document));
    const mainVideo = findMainVideo(document);
    const videoObservationFromFrame: VideoObservationFromFrame = {
      source: FRAME_MESSAGE_SOURCE,
      type: "video-observation",
      observation: mainVideo === null ? null : observeVideo(mainVideo),
      lastEndedMedia: lastEndedMediaSignal(),
    };
    window.top?.postMessage(videoObservationFromFrame, "*");
  });
}

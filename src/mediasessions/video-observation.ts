// TODO: Validate
import type { MediaObservation, ObservedPlaybackStatus } from "../playback/playback-end-detector";

// TODO: Validate
function videosIn(searchRoot: Document | ShadowRoot, foundVideos: HTMLVideoElement[]): void {
  foundVideos.push(...searchRoot.querySelectorAll("video"));
  const elementWalker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_ELEMENT);
  for (let walkedNode = elementWalker.nextNode(); walkedNode !== null; walkedNode = elementWalker.nextNode()) {
    const walkedShadowRoot = (walkedNode as Element).shadowRoot;
    if (walkedShadowRoot !== null) videosIn(walkedShadowRoot, foundVideos);
  }
}

// TODO: Validate
function isVideoPlaying(video: HTMLVideoElement): boolean {
  return !video.paused && !video.ended;
}

// TODO: Validate
function videoArea(video: HTMLVideoElement): number {
  const videoBounds = video.getBoundingClientRect();
  return videoBounds.width * videoBounds.height;
}

// TODO: Validate
export function findMainVideo(pageDocument: Document): HTMLVideoElement | null {
  const foundVideos: HTMLVideoElement[] = [];
  videosIn(pageDocument, foundVideos);
  const candidateVideos = foundVideos.filter((foundVideo) => foundVideo.isConnected);
  if (candidateVideos.length === 0) return null;
  const playingVideos = candidateVideos.filter(isVideoPlaying);
  const preferredVideos = playingVideos.length > 0 ? playingVideos : candidateVideos;
  return preferredVideos.reduce((largestVideo, preferredVideo) =>
    videoArea(preferredVideo) > videoArea(largestVideo) ? preferredVideo : largestVideo,
  );
}

// TODO: Validate
function observedPlaybackStatus(video: HTMLVideoElement): ObservedPlaybackStatus {
  if (video.ended) return "STOPPED";
  if (video.paused) return "PAUSED";
  if (video.seeking || video.readyState < 3) return "BUFFERING";
  return "PLAYING";
}

// TODO: Validate
export function observeVideo(video: HTMLVideoElement): MediaObservation {
  const playbackStatus = observedPlaybackStatus(video);
  const mediaSessionTitle = navigator.mediaSession?.metadata?.title ?? "";
  const videoSourceAddress = video.currentSrc || video.src;
  return {
    playbackStatus,
    position: Math.max(0, Math.floor(video.currentTime * 1000)),
    duration: Number.isFinite(video.duration) && video.duration > 0 ? Math.floor(video.duration * 1000) : null,
    mediaTitle: mediaSessionTitle.length > 0 ? mediaSessionTitle : null,
    playbackSpeed: playbackStatus === "PLAYING" ? video.playbackRate : 0,
    mediaId: videoSourceAddress.length > 0 ? videoSourceAddress : null,
  };
}

// TODO: Validate
export function pauseEveryVideo(pageDocument: Document): void {
  const foundVideos: HTMLVideoElement[] = [];
  videosIn(pageDocument, foundVideos);
  for (const foundVideo of foundVideos) foundVideo.pause();
}

// TODO: Validate
export function findEveryVideo(pageDocument: Document): HTMLVideoElement[] {
  const foundVideos: HTMLVideoElement[] = [];
  videosIn(pageDocument, foundVideos);
  return foundVideos;
}

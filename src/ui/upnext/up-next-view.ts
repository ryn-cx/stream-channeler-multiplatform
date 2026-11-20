// TODO: Validate
import type { GuideVideo } from "../../data/models";
import { announce, stopAnnouncement } from "../../playback/up-next-announcer";
import type { ImageLoader } from "../common/image-loader";
import type { RemoteAction, RemoteActionHandler, RemoteInput } from "../common/remote-input";
import { actionButton, textLabel } from "../common/ui";
import { upNextAnnouncement } from "./up-next-announcement";

// TODO: Validate
export class UpNextView implements RemoteActionHandler {
  private readonly remoteInput: RemoteInput;
  private readonly imageLoader: ImageLoader;
  private readonly channelName: string | null;
  private readonly nextVideo: GuideVideo;
  private readonly followingVideo: GuideVideo | null;
  private readonly onFinished: (playsNextVideo: boolean) => void;
  private readonly upNextLayer: HTMLDivElement;
  private playUpNextTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hasFinishedUpNext = false;
  // TODO: Validate
  private readonly finishWhenHidden = () => {
    if (document.visibilityState === "hidden") this.finishUpNext(false);
  };

  // TODO: Validate
  constructor(
    remoteInput: RemoteInput,
    imageLoader: ImageLoader,
    channelName: string | null,
    nextVideo: GuideVideo,
    followingVideo: GuideVideo | null,
    onFinished: (playsNextVideo: boolean) => void,
  ) {
    this.remoteInput = remoteInput;
    this.imageLoader = imageLoader;
    this.channelName = channelName;
    this.nextVideo = nextVideo;
    this.followingVideo = followingVideo;
    this.onFinished = onFinished;
    this.upNextLayer = this.buildUpNextLayout();
  }

  // TODO: Validate
  show(): void {
    document.body.append(this.upNextLayer);
    this.remoteInput.pushHandler(this);
    document.addEventListener("visibilitychange", this.finishWhenHidden);
    this.playUpNextAfter(30_000);
    const announcementText = upNextAnnouncement(
      this.nextVideo.title,
      this.nextVideo.subtitle,
      this.followingVideo === null ? null : (this.followingVideo.title ?? ""),
      this.followingVideo?.subtitle ?? null,
    );
    announce(announcementText, (wasAnnouncementSpoken) => this.playUpNextAfter(wasAnnouncementSpoken ? 1_000 : 5_000));
  }

  // TODO: Validate
  handleRemoteAction(remoteAction: RemoteAction): boolean {
    // A keyboard viewer can tab to the Cancel button, and Enter on it must cancel rather than play.
    const focusedUpNextButton = document.activeElement;
    if (
      remoteAction === "select" &&
      focusedUpNextButton instanceof HTMLButtonElement &&
      this.upNextLayer.contains(focusedUpNextButton)
    ) {
      focusedUpNextButton.click();
    } else if (remoteAction === "select" || remoteAction === "play") {
      this.finishUpNext(true);
    } else if (remoteAction === "back") {
      this.finishUpNext(false);
    }
    return true;
  }

  // TODO: Validate
  private buildUpNextLayout(): HTMLDivElement {
    const upNextLayer = document.createElement("div");
    upNextLayer.className = "up-next-layer";
    const upNextColumn = document.createElement("div");
    upNextColumn.className = "up-next-column";
    if (this.channelName !== null) {
      upNextColumn.append(textLabel(this.channelName.toUpperCase(), "up-next-channel-name"));
    }
    const upNextVideosRow = document.createElement("div");
    upNextVideosRow.className = "up-next-videos-row";
    upNextVideosRow.append(this.videoCard("UP NEXT", this.nextVideo, "up-next-card-next"));
    if (this.followingVideo !== null) {
      upNextVideosRow.append(this.videoCard("THEN", this.followingVideo, "up-next-card-following"));
    }
    upNextColumn.append(upNextVideosRow, textLabel("Select to play now · Back to cancel", "up-next-hint"));
    const upNextButtonRow = document.createElement("div");
    upNextButtonRow.className = "up-next-button-row";
    upNextButtonRow.append(
      actionButton("Play now", () => this.finishUpNext(true)),
      actionButton("Cancel", () => this.finishUpNext(false)),
    );
    upNextColumn.append(upNextButtonRow);
    upNextLayer.append(upNextColumn);
    return upNextLayer;
  }

  // TODO: Validate
  private videoCard(headingText: string, video: GuideVideo, cardClassName: string): HTMLDivElement {
    const videoCard = document.createElement("div");
    videoCard.className = `up-next-card ${cardClassName}`;
    const videoThumbnail = document.createElement("img");
    videoThumbnail.className = "up-next-thumbnail";
    videoThumbnail.alt = "";
    this.imageLoader.loadInto(videoThumbnail, video.thumbnailUrl);
    const videoThumbnailFrame = document.createElement("div");
    videoThumbnailFrame.className = "up-next-thumbnail-frame";
    videoThumbnailFrame.append(videoThumbnail);
    videoCard.append(
      textLabel(headingText, "up-next-heading"),
      videoThumbnailFrame,
      textLabel(video.title ?? "", "up-next-title"),
    );
    if (video.subtitle.length > 0) videoCard.append(textLabel(video.subtitle, "up-next-subtitle"));
    return videoCard;
  }

  // TODO: Validate
  private playUpNextAfter(delay: number): void {
    if (this.playUpNextTimeoutId !== null) clearTimeout(this.playUpNextTimeoutId);
    this.playUpNextTimeoutId = setTimeout(() => this.finishUpNext(true), delay);
  }

  // TODO: Validate
  private finishUpNext(playsNextVideo: boolean): void {
    if (this.hasFinishedUpNext) return;
    this.hasFinishedUpNext = true;
    if (this.playUpNextTimeoutId !== null) clearTimeout(this.playUpNextTimeoutId);
    stopAnnouncement();
    document.removeEventListener("visibilitychange", this.finishWhenHidden);
    this.remoteInput.removeHandler(this);
    this.upNextLayer.remove();
    this.onFinished(playsNextVideo);
  }
}

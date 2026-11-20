// TODO: Validate

// TODO: Validate
export function upNextAnnouncement(
  nextVideoTitle: string | null,
  nextVideoSubtitle: string,
  followingVideoTitle: string | null = null,
  followingVideoSubtitle: string | null = null,
): string {
  const spokenNextVideoName = spokenVideoName(nextVideoTitle, nextVideoSubtitle);
  const nextVideoAnnouncement = spokenNextVideoName.length === 0 ? "Up next." : `Up next: ${spokenNextVideoName}.`;
  if (followingVideoTitle === null && followingVideoSubtitle === null) return nextVideoAnnouncement;
  const isFollowingVideoSameShow = followingVideoTitle?.trim() === nextVideoTitle?.trim();
  const spokenFollowingVideoName =
    spokenVideoName(isFollowingVideoSameShow ? null : followingVideoTitle, followingVideoSubtitle ?? "") ||
    spokenVideoName(followingVideoTitle, "");
  if (spokenFollowingVideoName.length === 0) return nextVideoAnnouncement;
  return `${nextVideoAnnouncement} Then: ${spokenFollowingVideoName}.`;
}

// TODO: Validate
function spokenVideoName(videoTitle: string | null, videoSubtitle: string): string {
  const spokenEpisodeName = videoSubtitle.replace(/^S\d+\s*Ep\d+\s*(·\s*)?/, "").trim();
  return [videoTitle?.trim() ?? "", spokenEpisodeName].filter((spokenPart) => spokenPart.length > 0).join(". ");
}

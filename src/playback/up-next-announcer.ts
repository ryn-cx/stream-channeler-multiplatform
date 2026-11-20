// TODO: Validate
let spokenAnnouncement: SpeechSynthesisUtterance | null = null;

// TODO: Validate
export function announce(announcementText: string, onFinished: (wasAnnouncementSpoken: boolean) => void): void {
  stopAnnouncement();
  if (!("speechSynthesis" in window)) {
    onFinished(false);
    return;
  }
  const announcementUtterance = new SpeechSynthesisUtterance(announcementText);
  spokenAnnouncement = announcementUtterance;
  announcementUtterance.onend = () => {
    if (spokenAnnouncement !== announcementUtterance) return;
    spokenAnnouncement = null;
    onFinished(true);
  };
  announcementUtterance.onerror = () => {
    if (spokenAnnouncement !== announcementUtterance) return;
    spokenAnnouncement = null;
    onFinished(false);
  };
  window.speechSynthesis.speak(announcementUtterance);
}

// TODO: Validate
export function stopAnnouncement(): void {
  spokenAnnouncement = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

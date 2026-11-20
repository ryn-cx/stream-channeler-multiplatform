// TODO: Validate
function hourAndMinuteOf(time: Date): string {
  const twelveHour = time.getHours() % 12 === 0 ? 12 : time.getHours() % 12;
  const meridiem = time.getHours() < 12 ? "AM" : "PM";
  return `${twelveHour}:${String(time.getMinutes()).padStart(2, "0")}${meridiem}`;
}

// TODO: Validate
export function formatSlotTime(time: number): string {
  return hourAndMinuteOf(new Date(time));
}

// TODO: Validate
export function formatSlotHeaderTime(time: number): string {
  const slotTime = new Date(time);
  return `${slotTime.getMonth() + 1}/${slotTime.getDate()} ${hourAndMinuteOf(slotTime)}`;
}

// TODO: Validate
export function formatVideoDuration(totalSeconds: number): string {
  const wholeSeconds = Math.trunc(totalSeconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}` : `${minutes}:${paddedSeconds}`;
}

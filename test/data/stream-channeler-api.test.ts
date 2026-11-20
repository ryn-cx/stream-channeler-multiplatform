// TODO: Validate
import { describe, expect, it } from "vitest";
import { localTimeWithOffset } from "../../src/data/stream-channeler-api";

// TODO: Validate
function localTimeAtOffset(offsetMinutesEastOfUtc: number): Date {
  const localTime = new Date(2026, 0, 2, 3, 4, 5);
  // Date.getTimezoneOffset returns minutes west of UTC, so the sign is flipped.
  localTime.getTimezoneOffset = () => -offsetMinutesEastOfUtc;
  return localTime;
}

describe("localTimeWithOffset", () => {
  it("writes the local time with its UTC offset", () => {
    expect(localTimeWithOffset(localTimeAtOffset(-300))).toBe("2026-01-02T03:04:05-05:00");
    expect(localTimeWithOffset(localTimeAtOffset(330))).toBe("2026-01-02T03:04:05+05:30");
  });

  it("writes a zero offset as Z, like the Android app", () => {
    expect(localTimeWithOffset(localTimeAtOffset(0))).toBe("2026-01-02T03:04:05Z");
  });
});

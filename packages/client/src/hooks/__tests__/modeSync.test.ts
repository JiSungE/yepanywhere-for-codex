import { describe, expect, it } from "vitest";
import {
  getNextExpectedModeVersion,
  shouldApplyServerModeVersion,
} from "../modeSync";

describe("modeSync", () => {
  it("accepts the first server mode update at version 0", () => {
    expect(
      shouldApplyServerModeVersion(
        { lastKnownVersion: -1, pendingVersion: null },
        0,
      ),
    ).toBe(true);
  });

  it("rejects stale updates while a newer local mode change is pending", () => {
    expect(
      shouldApplyServerModeVersion(
        { lastKnownVersion: 0, pendingVersion: 1 },
        0,
      ),
    ).toBe(false);
  });

  it("accepts the server confirmation for the pending local mode change", () => {
    expect(
      shouldApplyServerModeVersion(
        { lastKnownVersion: 0, pendingVersion: 1 },
        1,
      ),
    ).toBe(true);
  });

  it("computes the next expected mode version from the last known version", () => {
    expect(getNextExpectedModeVersion(-1)).toBe(1);
    expect(getNextExpectedModeVersion(0)).toBe(1);
    expect(getNextExpectedModeVersion(4)).toBe(5);
  });
});

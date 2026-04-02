import { describe, expect, it } from "vitest";
import {
  normalizeLegacyEffortLevel,
  reasoningEffortToConfig,
  thinkingOptionToConfig,
} from "../src/types.js";

describe("reasoning helpers", () => {
  it("maps legacy max effort to xhigh", () => {
    expect(normalizeLegacyEffortLevel("max")).toBe("xhigh");
  });

  it("converts reasoning effort to adaptive thinking config", () => {
    expect(reasoningEffortToConfig("medium")).toEqual({
      thinking: { type: "adaptive" },
      effort: "medium",
    });
  });

  it("keeps legacy thinking wire compatible while normalizing max", () => {
    expect(thinkingOptionToConfig("on:max")).toEqual({
      thinking: { type: "adaptive" },
      effort: "xhigh",
    });
  });
});

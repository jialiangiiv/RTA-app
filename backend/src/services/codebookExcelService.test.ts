import { describe, expect, it } from "vitest";
import { findAllOccurrences, normalizeWhitespace } from "./codebookExcelService";

describe("findAllOccurrences", () => {
  it("finds an exact match", () => {
    const haystack = "I remember when I first began this work.";
    const result = findAllOccurrences(haystack, "when I first began");
    expect(result).toEqual([{ start: 11, end: 29 }]);
    expect(haystack.slice(result[0].start, result[0].end)).toBe("when I first began");
  });

  it("matches across a normalized line break in the transcript", () => {
    const haystack = "when I first\nbegan this work";
    const result = findAllOccurrences(haystack, "when I first began");
    expect(result).toHaveLength(1);
    expect(haystack.slice(result[0].start, result[0].end)).toBe("when I first\nbegan");
  });

  it("matches when the needle itself has extra/irregular whitespace", () => {
    const haystack = "when I first began this work";
    const result = findAllOccurrences(haystack, "when   I first\n began");
    expect(result).toEqual([{ start: 0, end: 18 }]);
  });

  it("returns every occurrence, in order, so the caller can take the first", () => {
    const haystack = "too tired to keep up. Honestly, too tired to keep up most days.";
    const result = findAllOccurrences(haystack, "too tired to keep up");
    expect(result).toHaveLength(2);
    expect(result[0].start).toBeLessThan(result[1].start);
    expect(haystack.slice(result[0].start, result[0].end)).toBe("too tired to keep up");
  });

  it("returns no matches when the text isn't present", () => {
    expect(findAllOccurrences("nothing relevant here", "when I first began")).toEqual([]);
  });

  it("returns no matches for a blank needle", () => {
    expect(findAllOccurrences("some text", "   ")).toEqual([]);
  });

  it("escapes regex-special characters in the needle", () => {
    const haystack = "cost was $5.00 (approx.) per unit";
    const result = findAllOccurrences(haystack, "$5.00 (approx.)");
    expect(result).toEqual([{ start: 9, end: 24 }]);
  });
});

describe("normalizeWhitespace", () => {
  it("collapses newlines and repeated spaces to a single space, and trims", () => {
    expect(normalizeWhitespace("  Why did\nyou   start?  ")).toBe("Why did you start?");
  });
});

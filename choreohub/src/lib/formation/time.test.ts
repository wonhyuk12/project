import { describe, expect, it } from "vitest";
import { formatMMSS, parseMMSS } from "./time";

describe("formatMMSS", () => {
  it("formats seconds as m:ss", () => {
    expect(formatMMSS(0)).toBe("0:00");
    expect(formatMMSS(65)).toBe("1:05");
    expect(formatMMSS(180)).toBe("3:00");
  });
});

describe("parseMMSS", () => {
  it("parses colon notation", () => {
    expect(parseMMSS("3:00")).toBe(180);
    expect(parseMMSS("2:30")).toBe(150);
  });

  it("parses short plain digits as seconds", () => {
    expect(parseMMSS("45")).toBe(45);
    expect(parseMMSS("5")).toBe(5);
  });

  it("parses packed digits (>2 chars) as MMSS", () => {
    expect(parseMMSS("300")).toBe(180); // 3:00
    expect(parseMMSS("230")).toBe(150); // 2:30
    expect(parseMMSS("1230")).toBe(750); // 12:30
  });

  it("rejects invalid seconds", () => {
    expect(parseMMSS("199")).toBeNull(); // 1:99 invalid
    expect(parseMMSS("abc")).toBeNull();
  });
});

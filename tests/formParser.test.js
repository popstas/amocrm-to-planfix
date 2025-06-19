import { describe, it, expect } from "vitest";
import { parseFormEncoded } from "../src/formParser";

describe("parseFormEncoded", () => {
  it("parses a urlencoded string", () => {
    const str = "a=1&b=hello%20world";
    const result = parseFormEncoded(str);
    expect(result).toEqual({ a: "1", b: "hello world" });
  });

  it("throws on non-string input", () => {
    expect(() => parseFormEncoded(null)).toThrow(TypeError);
  });
});

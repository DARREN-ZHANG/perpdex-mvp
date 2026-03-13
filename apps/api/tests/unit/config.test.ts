import { describe, expect, it } from "vitest";
import { parseProcessRoles } from "../../src/config/index";

describe("parseProcessRoles", () => {
  it("enables every role by default", () => {
    expect(Array.from(parseProcessRoles(undefined))).toEqual([
      "api",
      "worker",
      "scheduler",
      "indexer"
    ]);
  });

  it("parses explicit role lists", () => {
    expect(Array.from(parseProcessRoles("api,worker"))).toEqual([
      "api",
      "worker"
    ]);
  });

  it("rejects invalid role names", () => {
    expect(() => parseProcessRoles("api,unknown")).toThrow(
      "Invalid APP_ROLES entry: unknown"
    );
  });
});

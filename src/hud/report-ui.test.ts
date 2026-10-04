import { describe, expect, it } from "vitest";
import { REPORT_KINDS } from "../lib/reports";
import { REPORT_SUBTYPES, reportKindIcon } from "./report-ui";

describe("report subtypes", () => {
  it("gives every reportable kind a sub-type step and a glass icon", () => {
    for (const { kind } of REPORT_KINDS) {
      expect(REPORT_SUBTYPES[kind].length).toBeGreaterThanOrEqual(2);
      expect(reportKindIcon(kind)).toContain(`rs-ico ${kind}`);
    }
  });
});

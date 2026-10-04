import type { ReportableKind } from "../lib/reports";

/** Sub-type step after the report grid. UI only — submit still sends the kind. */
export const REPORT_SUBTYPES: Record<ReportableKind, ReadonlyArray<{ id: string; label: string }>> = {
  jam: [
    { id: "heavy", label: "Heavy" },
    { id: "standstill", label: "Standstill" },
    { id: "backup", label: "Backup" },
  ],
  police: [
    { id: "visible", label: "Visible" },
    { id: "hidden", label: "Hidden" },
  ],
  crash: [
    { id: "minor", label: "Minor" },
    { id: "blocking", label: "Blocking" },
    { id: "other-side", label: "Other side" },
  ],
  hazard: [
    { id: "object", label: "Object" },
    { id: "shoulder", label: "Shoulder" },
    { id: "weather", label: "Weather" },
  ],
  closure: [
    { id: "all", label: "All lanes" },
    { id: "one-side", label: "One side" },
    { id: "exit", label: "Exit closed" },
  ],
};

const ICO: Record<ReportableKind, string> = {
  jam: `<path d="M4 8h4v3H4zm6 0h4v3h-4zm6 0h4v3h-4M4 13h16v2H4z"/>`,
  police: `<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>`,
  crash: `<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  hazard: `<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  closure: `<rect x="4" y="8" width="16" height="8" rx="2"/>`,
};

export function reportKindIcon(kind: ReportableKind): string {
  return `<span class="rs-ico ${kind}" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26">${ICO[kind]}</svg></span>`;
}

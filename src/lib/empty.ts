/**
 * Copy for empty HUD numbers. Never "—": say what will appear.
 * Real values replace these once a plan, trip, or week of drives exists.
 */
export const EMPTY = {
  score: "After a plan",
  eta: "After a plan",
  driveTime: "After a trip",
  driven: "After a trip",
  line: "After a trip",
  dest: "Your destination",
  maneuverDist: "Next turn",
  maneuverInstr: "Follow the line",
  remain: "Remaining once GPS locks",
  avgSmooth: "After a drive",
  onTime: "After saved drives",
  weekValue: "After two weeks",
  posted: "No sign",
  expected: "Typical",
} as const;

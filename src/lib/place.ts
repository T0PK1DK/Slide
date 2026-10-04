/** Split a Photon label into a place name and the rest of the address. Real strings only. */
export function splitPlaceLabel(label: string): { name: string; address: string } {
  const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
  const name = parts.find((p) => p && !/^\d+[a-z]?$/i.test(p)) ?? parts[0] ?? "Place";
  const address = parts.filter((p) => p !== name).join(", ");
  return { name, address: address || label };
}

/**
 * Minimal GTFS-realtime VehiclePositions decoder (protobuf wire format), just
 * the fields the radar needs — no protobuf library in the bundle or Function.
 * Field numbers from the GTFS-realtime spec (gtfs-realtime.proto):
 *   FeedMessage   { 1 header, 2 entity* }
 *   FeedEntity    { 1 id, 2 is_deleted, 4 vehicle }
 *   VehiclePosition { 1 trip, 2 position, 5 timestamp, 8 vehicle }
 *   TripDescriptor  { 1 trip_id, 5 route_id }
 *   Position        { 1 latitude f32, 2 longitude f32, 3 bearing f32, 5 speed f32 (m/s) }
 *   VehicleDescriptor { 1 id, 2 label }
 */
export type TransitVehicle = {
  id: string;
  lat: number;
  lon: number;
  bearing: number | null;
  speedMps: number | null;
  routeId: string | null;
  label: string | null;
  timestamp: number | null;
};

type Field = { no: number; wire: number; value: number | bigint | Uint8Array };

function* fields(buf: Uint8Array): Generator<Field> {
  let i = 0;
  const varint = (): bigint => {
    let shift = 0n, out = 0n;
    for (;;) {
      if (i >= buf.length) throw new Error("truncated varint");
      const b = buf[i++];
      out |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) return out;
      shift += 7n;
      if (shift > 70n) throw new Error("varint too long");
    }
  };
  while (i < buf.length) {
    const key = Number(varint());
    const no = key >>> 3, wire = key & 7;
    if (wire === 0) yield { no, wire, value: varint() };
    else if (wire === 1) { if (i + 8 > buf.length) throw new Error("truncated"); yield { no, wire, value: buf.subarray(i, i + 8) }; i += 8; }
    else if (wire === 2) {
      const len = Number(varint());
      if (i + len > buf.length) throw new Error("truncated bytes");
      yield { no, wire, value: buf.subarray(i, i + len) };
      i += len;
    } else if (wire === 5) { if (i + 4 > buf.length) throw new Error("truncated"); yield { no, wire, value: buf.subarray(i, i + 4) }; i += 4; }
    else throw new Error(`unsupported wire type ${wire}`);
  }
}

const f32 = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true);
const text = (b: Uint8Array) => new TextDecoder().decode(b);

function position(buf: Uint8Array) {
  const p = { lat: NaN, lon: NaN, bearing: null as number | null, speed: null as number | null };
  for (const f of fields(buf)) {
    if (f.wire !== 5) continue;
    const v = f32(f.value as Uint8Array);
    if (f.no === 1) p.lat = v;
    else if (f.no === 2) p.lon = v;
    else if (f.no === 3) p.bearing = v;
    else if (f.no === 5) p.speed = v;
  }
  return p;
}

function strField(buf: Uint8Array, no: number): string | null {
  for (const f of fields(buf)) if (f.no === no && f.wire === 2) return text(f.value as Uint8Array);
  return null;
}

function vehiclePosition(buf: Uint8Array, entityId: string): TransitVehicle | null {
  let pos: ReturnType<typeof position> | null = null;
  let routeId: string | null = null, label: string | null = null, vid: string | null = null, ts: number | null = null;
  for (const f of fields(buf)) {
    if (f.no === 1 && f.wire === 2) routeId = strField(f.value as Uint8Array, 5);
    else if (f.no === 2 && f.wire === 2) pos = position(f.value as Uint8Array);
    else if (f.no === 5 && f.wire === 0) ts = Number(f.value);
    else if (f.no === 8 && f.wire === 2) { vid = strField(f.value as Uint8Array, 1); label = strField(f.value as Uint8Array, 2); }
  }
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon) || (pos.lat === 0 && pos.lon === 0)) return null;
  return { id: vid ?? entityId, lat: pos.lat, lon: pos.lon, bearing: pos.bearing, speedMps: pos.speed, routeId, label, timestamp: ts };
}

/** Pure: a GTFS-realtime VehiclePositions feed → vehicles with a usable position. */
export function decodeVehiclePositions(buf: Uint8Array): TransitVehicle[] {
  const out: TransitVehicle[] = [];
  for (const f of fields(buf)) {
    if (f.no !== 2 || f.wire !== 2) continue;
    let id = "", deleted = false, vp: Uint8Array | null = null;
    for (const e of fields(f.value as Uint8Array)) {
      if (e.no === 1 && e.wire === 2) id = text(e.value as Uint8Array);
      else if (e.no === 2 && e.wire === 0) deleted = e.value !== 0n;
      else if (e.no === 4 && e.wire === 2) vp = e.value as Uint8Array;
    }
    if (deleted || !vp) continue;
    const v = vehiclePosition(vp, id);
    if (v) out.push(v);
  }
  return out;
}

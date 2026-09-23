/**
 * Current conditions for the map's clock card. Open-Meteo is free, keyless and
 * CC BY 4.0 (credit shown in the card), so it fits the "legal, open sources
 * only" rule. Cached for 15 minutes; any failure just hides the weather half.
 */
export type Weather = { tempF: number; label: string; isDay: boolean };

const TTL_MS = 15 * 60 * 1000;
let cache: { key: string; at: number; value: Weather } | null = null;

const CODES: Array<[number[], string]> = [
  [[0], "Clear"],
  [[1, 2], "Partly cloudy"],
  [[3], "Cloudy"],
  [[45, 48], "Fog"],
  [[51, 53, 55, 56, 57], "Drizzle"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rain"],
  [[95, 96, 99], "Storms"],
];

function describe(code: number): string {
  return CODES.find(([cs]) => cs.includes(code))?.[1] ?? "—";
}

export async function currentWeather(lat: number, lon: number): Promise<Weather | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.value;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit`;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } };
    const c = json.current;
    if (typeof c?.temperature_2m !== "number") return null;
    const value = { tempF: Math.round(c.temperature_2m), label: describe(c.weather_code ?? -1), isDay: c.is_day === 1 };
    cache = { key, at: Date.now(), value };
    return value;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

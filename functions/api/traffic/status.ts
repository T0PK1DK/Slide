/**
 * GET /api/traffic/status — whether TomTom is keyed on this deploy.
 * The key itself never leaves the Worker.
 */
import { json } from "../../lib/cache";

type Env = { TOMTOM_API_KEY?: string };

export async function onRequestGet({ env }: { env: Env }): Promise<Response> {
  return json({ configured: Boolean(env.TOMTOM_API_KEY) }, 30);
}

# Slide — VIA design system

The night HUD, premium pass. Source of truth for any agent touching `src/styles.css`.
Skin lives in the **VIA skin** block at the bottom of `styles.css` — add new component styles there, using these tokens.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#07080a` | App ground |
| `--glass` / `--glass-2` | `rgba(15,16,18,.86)` / `.96` | Panels over the map |
| `--surface` | `#16171a` | Cards, inputs, chips inside panels |
| `--line` | `#26272b` | 1px borders |
| `--text` | `#f4f3ef` | Primary text |
| `--muted` | `#a9a8ae` | Secondary text (≥4.5:1 on panels) |
| `--faint` | `#8c8b92` | Micro labels only |
| `--glow` | Garage pick, default `#f0a04b` copper | The ONE accent: route, maneuver tile, primary button, selected states |
| `--danger` | `#e5534b` | Off-route, over-limit, End |
| `--lift` | inset 1px white 6% | Top highlight on every panel |

## Type

- **Geist** for UI. **Geist Mono** for micro labels, speeds, posted-speed chip, status.
- Big numerals (distance, ETA, duration) are **weight 200**, tight tracking. Instructions and street names are **600**. Never thin type under 20px.
- Micro labels: mono, 10–11px, uppercase, `.16em` tracking.

## Rules

1. One accent. Everything else greyscale. Red only for danger.
2. Radii: panels 24–30px, cards 16–18px, pills 999px. Touch targets ≥44px.
3. Speed-limit sign is the **US regulatory** rectangle (white, black border), not the EU red ring.
4. No fake data: no traffic coloring until a real source exists (HANDOFF rule).
5. Keep the night HUD (HANDOFF rule 6). A high-glare daylight theme is a future opt-in toggle, never the default.

## Next design slices (mockups exist on the VIA canvas)

- Trip timeline on the drive bar: progress + ghost delta + posted-speed drops as ticks.
- Garage restyle with line-art car.
- Route overview cards with a posted-speed band strip instead of traffic.
- Onboarding (location permission, Home/Work) and offline/no-route states.

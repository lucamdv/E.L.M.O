# Golden Hour micro-calibration

Date: 2026-10-02

## Scope

Only the background fields of the 16:30, 18:00, and 19:30 entries in `ELMO_COLOR_STOPS` were recalibrated. No Elmo, WebGL, motion, face, layout, Spatial UI, typography, accessibility, fallback, or integration code changed.

## Final values

| Time | Background left | Background center | Background right |
| --- | --- | --- | --- |
| 16:30 | `#E2D8C1` | `#CAD7DA` | `#BACFDB` |
| 18:00 | `#E6C991` | `#A7AAA6` | `#687F91` |
| 19:30 | `#716C6A` | `#3D5165` | `#233A57` |

The Elmo core, rim, and highlight values at all stops remain unchanged.

## Transition behavior

- 16:00–16:30: daylight remains dominant; a restrained warm influence begins at upper-left.
- 17:00: warm side becomes identifiable while the right side remains daylight blue-gray.
- 17:30–18:15: visual peak with champagne light, a broad neutral atmospheric center, and cool sky preserved at right.
- 18:30: warmth recedes without a gray dead zone.
- 19:00: only residual warm atmosphere remains.
- 19:30–20:00: continuous blue-hour transition with no purple, magenta, pink, orange, or muddy-brown midpoint.

The existing smoothstep + OKLCH interpolation remains unchanged. The existing optical-light chroma compression remains in place.

## Elmo response

Elmo remains blue-first. No core, geometry, opacity, material, face, camera, deformation, or animation value was changed. The existing champagne rim/highlight response remains localized to the warm-facing edge, while the opposite side stays cool. At 18:00 the contrast safeguard is active and the character remains clearly separated from the environment.

## Contrast audit

At 18:00:

- primary foreground: 7.83:1
- secondary foreground: 6.46:1
- tertiary foreground: 4.94:1
- foreground on material: 9.67:1
- estimated background luminance: 0.410
- estimated Elmo luminance: 0.327

The 16:00–20:00 audit found no missing canvas, horizontal overflow, or illegible foreground interval.

## Desktop captures — 1280 × 720

- `16-30-desktop-empty.png`
- `17-00-desktop-empty.png`
- `17-30-desktop-empty.png`
- `18-00-desktop-empty.png`
- `18-00-desktop-populated.png`
- `18-30-desktop-empty.png`
- `19-00-desktop-empty.png`
- `19-30-desktop-empty.png`

## Mobile captures — 390 × 844

- `17-30-mobile-empty.png`
- `18-00-mobile-empty.png`
- `18-00-mobile-populated.png`
- `18-30-mobile-empty.png`

## Day / Golden Hour / Night comparison

- Day: `../elmo-color-stops/final-14-00-idle-desktop.png`
- Golden Hour: `18-00-desktop-empty.png`
- Night: `../elmo-color-stops/final-22-00-idle-desktop.png`

The three frames have distinct identities: sky/daylight, directional golden sunlight, and deep-blue night.

## Technical validation

- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and static generation.
- Fresh final browser console: no warnings or errors.


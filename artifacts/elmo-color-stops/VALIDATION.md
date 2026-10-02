# Elmo color-stop validation

Date: 2026-10-02

## Scope

This pass changes only the ambient color architecture and the way its output illuminates the existing Elmo material. Shape, face, expressions, scale, operational motion, Spatial UI, layout, input, fixtures, and integrations were not redesigned.

## Source of truth

`src/core/ambient.ts` contains `ELMO_COLOR_STOPS`, the eight official stops at 05:30, 08:00, 10:00, 14:00, 16:30, 18:00, 19:30, and 22:00. Each stop owns the three background colors plus Elmo core, rim, and highlight.

The same module:

- converts sRGB hex values to OKLCH;
- interpolates only between adjacent official stops, including the circular 22:00 → 05:30 night segment;
- compresses chroma while crossing the large blue/gold hue distance so Golden Hour cannot drift through a purple/magenta midpoint;
- derives semantic foreground tokens and material surfaces from the interpolated light;
- applies continuous contrast safeguards to core depth, rim, highlight, and shell whitening.

## Calibrations

- Morning: stronger optical-blue core and mids, restrained frontal highlight, no white shell washout.
- Golden Hour: blue core remains canonical; warmth is directional and limited to rim/highlight response.
- Night: controlled silver-blue edge and highlight; no full-shell bloom.
- Foreground: luminance polarity is chosen by the side that can produce the strongest relational contrast. `text-on-material` is measured against the material surface itself.

At 18:00 the main foreground improved from 3.18:1 to 6.21:1; foreground on material improved to 7.09:1. The difficult 18:30 midpoint remains above AA for normal primary/secondary text (4.98:1 / 4.81:1) while preserving the official interpolated background.

## Mandatory transition audit

Canvas, core, rim, and highlight were verified at:

05:15, 05:30, 06:00, 06:45, 07:30, 08:00, 09:00, 10:00, 12:00, 14:00, 15:30, 16:30, 17:00, 17:30, 18:00, 18:30, 19:00, 19:30, 20:30, 22:00, 00:00, and 03:00.

No missing canvas or empty color token was found. The critical 17:00–19:30 interval was also audited independently after the Golden Hour and foreground corrections.

## State audit

All 24 combinations of the six operational states at 05:30, 08:00, 18:00, and 22:00 rendered successfully:

- IDLE
- LISTENING
- THINKING
- TOOL_EXECUTION
- SPEAKING
- ERROR

The existing state motion, face, and deformation behavior were preserved.

## Accessibility and fallback

- Reduced Motion toggle: active state confirmed with WebGL present.
- Reduced Transparency toggle: active state confirmed; Elmo remained blue and legible at 05:30.
- SVG fallback: manually selected and rendered with the correct accessible state label; switching back to WebGL succeeded.
- Semantic foreground contrast was audited at every official stop.

## Responsive audit

- Desktop 1280 × 720: matrix and populated scenes captured.
- Tablet 834 × 1194: populated 18:00 scene rendered with zero horizontal overflow.
- Mobile 390 × 844: 05:30, 14:00, 18:00, and 22:00 rendered with zero horizontal overflow.

## Runtime sample

Chrome desktop, populated 18:00 scene:

- 72 FPS sampled
- 13.9 ms frame time
- 2 draw calls
- 22,848 triangles
- DPR 1
- 206 ms renderer initialization

## Final desktop matrix

- `final-05-30-idle-desktop.png`
- `final-08-00-idle-desktop.png`
- `final-10-00-idle-desktop.png`
- `final-14-00-idle-desktop.png`
- `final-16-30-idle-desktop.png`
- `final-18-00-idle-desktop.png`
- `final-19-30-idle-desktop.png`
- `final-22-00-idle-desktop.png`

## Required scenario captures

- `final-05-30-tool-execution-desktop.png`
- `final-08-00-speaking-desktop.png`
- `final-18-00-populated-desktop.png`
- `final-22-00-populated-desktop.png`
- `final-18-00-populated-tablet.png`

## Mobile captures

- `final-05-30-idle-mobile.png`
- `final-14-00-idle-mobile.png`
- `final-18-00-idle-mobile.png`
- `final-22-00-idle-mobile.png`

## Technical verification

- `npm run build`: passed; production bundle and TypeScript completed.
- `npx eslint src scripts/capture-responsive.mjs`: passed.
- Fresh browser console on the final populated scene: no warnings or errors.


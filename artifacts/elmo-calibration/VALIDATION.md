# Elmo — Morning contrast and safe-bounds calibration

Date: 2026-10-02

## Scope

- Preserved the approved face, proportions, expressions, blue optical identity, Spatial UI, and Adaptive Ambient UI.
- Added a continuous morning-only material response that deepens internal midtones and occlusion without adding an outline or making the shell opaque.
- Added state-aware camera framing plus deformation recentering so asymmetric stretch remains inside the WebGL viewport.
- Added no dependencies and made no changes to scene graph, capabilities, input, or layout composition.

## Visual matrix

| Time | State | Viewport | Scene | Capture |
| --- | --- | --- | --- | --- |
| 08:00 | IDLE | 1280 × 720 | empty | `after-pass1-08-idle-desktop.png` |
| 08:00 | SPEAKING | 1280 × 720 | empty | `after-pass1-08-speaking-desktop.png` |
| 08:00 | TOOL_EXECUTION | 1280 × 720 | empty | `after-pass1-08-tool-desktop.png` |
| 08:00 | TOOL_EXECUTION | 390 × 844 | empty | `after-pass1-08-tool-mobile.png` |
| 10:00 | SPEAKING | 1280 × 720 | empty | `after-10-speaking-desktop.png` |
| 10:00 | SPEAKING | 390 × 844 | empty | `after-10-speaking-mobile.png` |
| 14:00 | LISTENING | 834 × 1194 | empty | `after-14-listening-tablet.png` |
| 14:00 | TOOL_EXECUTION | 390 × 844 | empty | `after-14-tool-mobile.png` |
| 18:00 | THINKING | 1280 × 720 | populated | `after-18-thinking-golden-populated-desktop.png` |
| 22:00 | ERROR | 1280 × 720 | populated | `after-22-error-night-populated-desktop.png` |

The set covers all six operational states, the five requested times, desktop/tablet/mobile, and the critical populated Golden Hour and Night scenes. All captures report viewport-width document bounds with no horizontal overflow. In the maximum asymmetric stretch cases, the complete silhouette remains visible with breathing room on every side.

## Before captures

- `before-08-speaking-desktop.png`
- `before-08-tool-desktop.png`
- `before-08-tool-mobile.png`
- Earlier baseline: `../elmo-canonical/luca-08-idle.png`

## Technical verification

- `npm run lint`: passed.
- `npm run build`: passed; Next.js production build and TypeScript completed successfully.
- Fresh browser console after build: no errors or warnings.
- Keyboard path: input → microphone control confirmed.
- Reduced Motion and Reduced Transparency toggles: both states applied and rendered with no console errors.
- WebGL fallback architecture, renderer metrics, triangle count, and draw-call count are unchanged.

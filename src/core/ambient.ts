export type AmbientPhase = "morning" | "afternoon" | "golden-hour" | "night";
export type Oklch = [lightness: number, chroma: number, hue: number];
export type Rgb = [red: number, green: number, blue: number];

export type AmbientColorStop = {
  time: string;
  backgroundLeft: string;
  backgroundCenter: string;
  backgroundRight: string;
  elmoCore: string;
  elmoRim: string;
  elmoHighlight: string;
};

export const ELMO_COLOR_STOPS: AmbientColorStop[] = [
  { time: "05:30", backgroundLeft: "#E8E2D2", backgroundCenter: "#D9DFDD", backgroundRight: "#D6E3E8", elmoCore: "#6C86F2", elmoRim: "#AFC7FF", elmoHighlight: "#F3F8FF" },
  { time: "08:00", backgroundLeft: "#EEE6D3", backgroundCenter: "#E6E7E0", backgroundRight: "#DCE7EB", elmoCore: "#708AF6", elmoRim: "#B6CCFF", elmoHighlight: "#F7FBFF" },
  { time: "10:00", backgroundLeft: "#F2EBD9", backgroundCenter: "#EAF0EE", backgroundRight: "#DDECF3", elmoCore: "#6F8DFF", elmoRim: "#BED4FF", elmoHighlight: "#F7FBFF" },
  { time: "14:00", backgroundLeft: "#DDEAF2", backgroundCenter: "#D5E8F3", backgroundRight: "#CAE1EE", elmoCore: "#5F7EF0", elmoRim: "#AFC8FF", elmoHighlight: "#F4F8FF" },
  { time: "16:30", backgroundLeft: "#E2D8C1", backgroundCenter: "#CAD7DA", backgroundRight: "#BACFDB", elmoCore: "#607BED", elmoRim: "#B3C9FF", elmoHighlight: "#F7F9FF" },
  { time: "18:00", backgroundLeft: "#E6C991", backgroundCenter: "#A7AAA6", backgroundRight: "#687F91", elmoCore: "#6681F2", elmoRim: "#FFD7A8", elmoHighlight: "#FFF4E6" },
  { time: "19:30", backgroundLeft: "#716C6A", backgroundCenter: "#3D5165", backgroundRight: "#233A57", elmoCore: "#6D89F9", elmoRim: "#C8D8FF", elmoHighlight: "#F6FAFF" },
  { time: "22:00", backgroundLeft: "#0A2141", backgroundCenter: "#041A37", backgroundRight: "#03142C", elmoCore: "#7290FF", elmoRim: "#D4E2FF", elmoHighlight: "#FBFDFF" },
];

export type ForegroundTokens = {
  primary: Oklch;
  secondary: Oklch;
  tertiary: Oklch;
  muted: Oklch;
  accent: Oklch;
  interactive: Oklch;
  onMaterial: Oklch;
};

export type AmbientTokens = {
  phase: AmbientPhase;
  progress: number;
  fromTime: string;
  toTime: string;
  backgroundLeft: Oklch;
  backgroundCenter: Oklch;
  backgroundRight: Oklch;
  elmoCore: Oklch;
  elmoRim: Oklch;
  elmoHighlight: Oklch;
  background: Oklch;
  backgroundDeep: Oklch;
  sky: Oklch;
  ambient: Oklch;
  sunlight: Oklch;
  horizon: Oklch;
  foreground: ForegroundTokens;
  surface: Oklch;
  surfaceOpacity: number;
  borderOpacity: number;
  shadowOpacity: number;
  reflectionIntensity: number;
  sunlightIntensity: number;
  surfaceGloss: number;
  orbDensity: number;
  orbCoreDepth: number;
  orbRimIntensity: number;
  orbHighlightIntensity: number;
  orbShellWhitening: number;
  orbWarmLight: number;
  estimatedBackgroundLuminance: number;
  estimatedElmoLuminance: number;
  contrastDelta: number;
  safeguardStrength: number;
  safeguardActive: boolean;
};

type ResolvedColorStop = AmbientColorStop & {
  minute: number;
  backgroundLeftColor: Oklch;
  backgroundCenterColor: Oklch;
  backgroundRightColor: Oklch;
  elmoCoreColor: Oklch;
  elmoRimColor: Oklch;
  elmoHighlightColor: Oklch;
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const smoothstep = (value: number) => value * value * (3 - 2 * value);

function minuteFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function srgbChannelToLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(channel: number) {
  const value = clamp(channel);
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

export function hexToOklch(hex: string): Oklch {
  const value = hex.replace("#", "");
  const red = srgbChannelToLinear(parseInt(value.slice(0, 2), 16) / 255);
  const green = srgbChannelToLinear(parseInt(value.slice(2, 4), 16) / 255);
  const blue = srgbChannelToLinear(parseInt(value.slice(4, 6), 16) / 255);
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  return [lightness, Math.sqrt(a * a + b * b), (hue + 360) % 360];
}

function mixHue(from: number, to: number, amount: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * amount + 360) % 360;
}

function mixColor(from: Oklch, to: Oklch, amount: number): Oklch {
  return [mix(from[0], to[0], amount), mix(from[1], to[1], amount), mixHue(from[2], to[2], amount)];
}

function mixOpticalLight(from: Oklch, to: Oklch, amount: number): Oklch {
  const color = mixColor(from, to, amount);
  const hueDistance = Math.abs(((to[2] - from[2] + 540) % 360) - 180);
  const neutralPass = hueDistance > 120 ? Math.pow(Math.sin(Math.PI * amount), 0.6) : 0;
  return [color[0], color[1] * (1 - neutralPass), color[2]];
}

function adjustLightness(color: Oklch, amount: number): Oklch {
  return [clamp(color[0] + amount, 0.04, 0.98), color[1], color[2]];
}

const RESOLVED_STOPS: ResolvedColorStop[] = ELMO_COLOR_STOPS.map((stop) => ({
  ...stop,
  minute: minuteFromTime(stop.time),
  backgroundLeftColor: hexToOklch(stop.backgroundLeft),
  backgroundCenterColor: hexToOklch(stop.backgroundCenter),
  backgroundRightColor: hexToOklch(stop.backgroundRight),
  elmoCoreColor: hexToOklch(stop.elmoCore),
  elmoRimColor: hexToOklch(stop.elmoRim),
  elmoHighlightColor: hexToOklch(stop.elmoHighlight),
}));

function resolveStopPair(minute: number) {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const firstMinute = RESOLVED_STOPS[0].minute;
  const last = RESOLVED_STOPS[RESOLVED_STOPS.length - 1];
  const cycleMinute = normalized < firstMinute ? normalized + 1440 : normalized;
  if (cycleMinute >= last.minute) {
    return { from: last, to: RESOLVED_STOPS[0], fromMinute: last.minute, toMinute: firstMinute + 1440, cycleMinute };
  }
  const fromIndex = RESOLVED_STOPS.findLastIndex((stop) => stop.minute <= cycleMinute);
  const from = RESOLVED_STOPS[Math.max(0, fromIndex)];
  const to = RESOLVED_STOPS[fromIndex + 1];
  return { from, to, fromMinute: from.minute, toMinute: to.minute, cycleMinute };
}

function phaseAt(minute: number): AmbientPhase {
  const normalized = ((minute % 1440) + 1440) % 1440;
  if (normalized >= 1170 || normalized < 330) return "night";
  if (normalized >= 990) return "golden-hour";
  if (normalized >= 840) return "afternoon";
  return "morning";
}

function windowStrength(minute: number, start: number, peakStart: number, peakEnd: number, end: number) {
  if (minute < start || minute > end) return 0;
  if (minute < peakStart) return smoothstep((minute - start) / Math.max(1, peakStart - start));
  if (minute <= peakEnd) return 1;
  return 1 - smoothstep((minute - peakEnd) / Math.max(1, end - peakEnd));
}

function foregroundFor(background: Oklch, targetContrast: number, tier: number) {
  const backgroundLuminance = relativeLuminance(background);
  // Choose the side of the luminance range that can produce the strongest
  // relationship with the current light. The crossover is where pure dark
  // and pure light have equal contrast, not an arbitrary theme boundary.
  const prefersDark = backgroundLuminance >= Math.sqrt(0.0525) - 0.05;
  let candidate: Oklch = prefersDark
    ? [0.19 + tier * 0.075, 0.025 + tier * 0.006, background[2]]
    : [0.95 - tier * 0.085, 0.018 + tier * 0.005, 245];
  for (let index = 0; index < 28 && contrastRatio(candidate, background) < targetContrast; index += 1) {
    candidate = adjustLightness(candidate, prefersDark ? -0.018 : 0.018);
  }
  return candidate;
}

export function ambientAt(minute: number): AmbientTokens {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const pair = resolveStopPair(normalized);
  const rawProgress = (pair.cycleMinute - pair.fromMinute) / Math.max(1, pair.toMinute - pair.fromMinute);
  const progress = smoothstep(clamp(rawProgress));
  const backgroundLeft = mixColor(pair.from.backgroundLeftColor, pair.to.backgroundLeftColor, progress);
  const backgroundCenter = mixColor(pair.from.backgroundCenterColor, pair.to.backgroundCenterColor, progress);
  const backgroundRight = mixColor(pair.from.backgroundRightColor, pair.to.backgroundRightColor, progress);
  const rawCore = mixColor(pair.from.elmoCoreColor, pair.to.elmoCoreColor, progress);
  const rawRim = mixOpticalLight(pair.from.elmoRimColor, pair.to.elmoRimColor, progress);
  const rawHighlight = mixColor(pair.from.elmoHighlightColor, pair.to.elmoHighlightColor, progress);

  const estimatedBackgroundLuminance = relativeLuminance(backgroundLeft) * 0.25 + relativeLuminance(backgroundCenter) * 0.55 + relativeLuminance(backgroundRight) * 0.2;
  const rawElmoLuminance = relativeLuminance(rawCore) * 0.68 + relativeLuminance(rawRim) * 0.24 + relativeLuminance(rawHighlight) * 0.08;
  const rawDelta = Math.abs(estimatedBackgroundLuminance - rawElmoLuminance);
  const safeDelta = estimatedBackgroundLuminance > 0.5 ? 0.26 : 0.18;
  const safeguardStrength = clamp((safeDelta - rawDelta) / safeDelta);
  const coreLuminance = relativeLuminance(rawCore);
  const correctionDirection = -Math.tanh((estimatedBackgroundLuminance - coreLuminance) * 8);
  const correctedCore = adjustLightness(rawCore, correctionDirection * safeguardStrength * 0.075);
  const elmoCore: Oklch = [correctedCore[0], clamp(correctedCore[1] + safeguardStrength * 0.018, 0, 0.25), correctedCore[2]];
  const elmoRim = adjustLightness(rawRim, correctionDirection * safeguardStrength * 0.025);
  const elmoHighlight = adjustLightness(rawHighlight, -safeguardStrength * 0.045);
  const estimatedElmoLuminance = relativeLuminance(elmoCore) * 0.72 + relativeLuminance(elmoRim) * 0.22 + relativeLuminance(elmoHighlight) * 0.06;
  const contrastDelta = Math.abs(estimatedBackgroundLuminance - estimatedElmoLuminance);

  const morningDefense = windowStrength(normalized, 300, 330, 480, 510);
  const goldenDefense = windowStrength(normalized, 1020, 1050, 1080, 1110);
  const nightDefense = normalized >= 1170 || normalized < 300 ? 1 : 0;
  const phase = phaseAt(normalized);
  const centerLuminance = relativeLuminance(backgroundCenter);
  const darkForegroundWins = centerLuminance >= Math.sqrt(0.0525) - 0.05;
  const surface = adjustLightness(backgroundCenter, darkForegroundWins ? 0.06 : -0.06);
  const foreground = {
    primary: foregroundFor(backgroundCenter, 7, 0),
    secondary: foregroundFor(backgroundCenter, 4.8, 1),
    tertiary: foregroundFor(backgroundCenter, 3.4, 2),
    muted: foregroundFor(backgroundCenter, 3, 3),
    accent: foregroundFor(backgroundCenter, 4.5, 1),
    interactive: foregroundFor(backgroundCenter, 4.5, 0.5),
    onMaterial: foregroundFor(surface, 7, 0),
  } satisfies ForegroundTokens;

  return {
    phase,
    progress,
    fromTime: pair.from.time,
    toTime: pair.to.time,
    backgroundLeft,
    backgroundCenter,
    backgroundRight,
    elmoCore,
    elmoRim,
    elmoHighlight,
    background: backgroundCenter,
    backgroundDeep: backgroundRight,
    sky: backgroundRight,
    ambient: mixColor(backgroundLeft, elmoHighlight, 0.16),
    sunlight: mixColor(elmoRim, elmoHighlight, 0.3),
    horizon: mixColor(backgroundRight, elmoRim, phase === "golden-hour" ? 0.28 : 0.12),
    foreground,
    surface,
    surfaceOpacity: phase === "night" ? 0.62 : 0.72,
    borderOpacity: estimatedBackgroundLuminance > 0.4 ? 0.27 : 0.2,
    shadowOpacity: mix(0.16, 0.42, 1 - estimatedBackgroundLuminance),
    reflectionIntensity: phase === "golden-hour" ? 0.94 : phase === "night" ? 0.7 : 0.84,
    sunlightIntensity: phase === "golden-hour" ? 0.78 : phase === "morning" ? 0.54 : 0.3,
    surfaceGloss: phase === "night" ? 0.54 : 0.82,
    orbDensity: 0.64 + morningDefense * 0.08 + safeguardStrength * 0.12,
    orbCoreDepth: 1 + morningDefense * 0.16 + safeguardStrength * 0.24,
    orbRimIntensity: 1 + safeguardStrength * 0.18 + goldenDefense * 0.04,
    orbHighlightIntensity: clamp(1 - morningDefense * 0.2 - nightDefense * 0.14 - safeguardStrength * 0.3, 0.52, 1),
    orbShellWhitening: clamp(1 - morningDefense * 0.24 - nightDefense * 0.18 - safeguardStrength * 0.34, 0.48, 1),
    orbWarmLight: goldenDefense,
    estimatedBackgroundLuminance,
    estimatedElmoLuminance,
    contrastDelta,
    safeguardStrength,
    safeguardActive: safeguardStrength > 0.01,
  };
}

export function toOklch([lightness, chroma, hue]: Oklch) {
  const stable = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  return `oklch(${stable(lightness)} ${stable(chroma)} ${stable(hue)})`;
}

export function toLinearRgb([lightness, chroma, hue]: Oklch): Rgb {
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function toSrgb(color: Oklch): Rgb {
  return toLinearRgb(color).map(linearChannelToSrgb) as Rgb;
}

export function relativeLuminance(color: Oklch) {
  const [red, green, blue] = toLinearRgb(color);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: Oklch, background: Oklch) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastAuditAt(minute: number) {
  const tokens = ambientAt(minute);
  return {
    primary: contrastRatio(tokens.foreground.primary, tokens.backgroundCenter),
    secondary: contrastRatio(tokens.foreground.secondary, tokens.backgroundCenter),
    tertiary: contrastRatio(tokens.foreground.tertiary, tokens.backgroundCenter),
    onMaterial: contrastRatio(tokens.foreground.onMaterial, tokens.surface),
  };
}

export function toHex(color: Oklch) {
  const channels = toSrgb(color).map((channel) => Math.round(clamp(channel) * 255).toString(16).padStart(2, "0"));
  return `#${channels.join("").toUpperCase()}`;
}

export function getRecifeMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function formatRecifeTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

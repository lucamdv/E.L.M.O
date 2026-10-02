"use client";

import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ambientAt,
  formatRecifeTime,
  getRecifeMinutes,
  toOklch,
  type AmbientTokens,
  type AmbientPhase,
} from "@/core/ambient";

type AmbientContextValue = {
  minute: number;
  phase: AmbientPhase;
  timeLabel: string;
  manualMinute: number | null;
  setManualMinute: (minute: number | null) => void;
  style: CSSProperties;
  tokens: AmbientTokens;
};

const AmbientContext = createContext<AmbientContextValue | null>(null);

const INITIAL_MINUTE = 750;

export function AmbientProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<Date | null>(null);
  const [manualMinute, setManualMinute] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const actualMinute = now ? getRecifeMinutes(now) : INITIAL_MINUTE;
  const minute = manualMinute ?? actualMinute;
  const tokens = ambientAt(minute);

  const style = useMemo(
    () =>
      ({
        "--ambient-background-left": toOklch(tokens.backgroundLeft),
        "--ambient-background-center": toOklch(tokens.backgroundCenter),
        "--ambient-background-right": toOklch(tokens.backgroundRight),
        "--ambient-background": toOklch(tokens.background),
        "--ambient-background-deep": toOklch(tokens.backgroundDeep),
        "--ambient-sky": toOklch(tokens.sky),
        "--ambient-light": toOklch(tokens.ambient),
        "--ambient-sunlight": toOklch(tokens.sunlight),
        "--ambient-horizon": toOklch(tokens.horizon),
        "--text-primary": toOklch(tokens.foreground.primary),
        "--text-secondary": toOklch(tokens.foreground.secondary),
        "--text-tertiary": toOklch(tokens.foreground.tertiary),
        "--text-muted": toOklch(tokens.foreground.muted),
        "--text-accent": toOklch(tokens.foreground.accent),
        "--text-interactive": toOklch(tokens.foreground.interactive),
        "--text-on-material": toOklch(tokens.foreground.onMaterial),
        "--ambient-surface": toOklch(tokens.surface),
        "--ambient-surface-opacity": tokens.surfaceOpacity.toFixed(3),
        "--ambient-border-opacity": tokens.borderOpacity.toFixed(3),
        "--ambient-shadow-opacity": tokens.shadowOpacity.toFixed(3),
        "--orb-reflection": tokens.reflectionIntensity.toFixed(3),
        "--sunlight-intensity": tokens.sunlightIntensity.toFixed(3),
        "--surface-gloss": tokens.surfaceGloss.toFixed(3),
        "--orb-density": tokens.orbDensity.toFixed(3),
        "--elmo-core": toOklch(tokens.elmoCore),
        "--elmo-rim": toOklch(tokens.elmoRim),
        "--elmo-highlight": toOklch(tokens.elmoHighlight),
        "--orb-core-depth": tokens.orbCoreDepth.toFixed(3),
        "--orb-rim-intensity": tokens.orbRimIntensity.toFixed(3),
        "--orb-highlight-intensity": tokens.orbHighlightIntensity.toFixed(3),
        "--orb-shell-whitening": tokens.orbShellWhitening.toFixed(3),
        "--orb-warm-light": tokens.orbWarmLight.toFixed(3),
      }) as CSSProperties,
    [tokens],
  );

  const timeLabel = manualMinute === null && now
    ? formatRecifeTime(now)
    : `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
        minute % 60,
      ).padStart(2, "0")}`;

  return (
    <AmbientContext.Provider
      value={{
        minute,
        phase: tokens.phase,
        timeLabel,
        manualMinute,
        setManualMinute,
        style,
        tokens,
      }}
    >
      {children}
    </AmbientContext.Provider>
  );
}

export function useAmbient() {
  const context = useContext(AmbientContext);
  if (!context) {
    throw new Error("useAmbient must be used inside AmbientProvider");
  }
  return context;
}

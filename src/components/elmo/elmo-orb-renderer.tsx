"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { AssistantState } from "@/core/types";
import { ElmoOrb } from "./elmo-orb";
import type {
  ElmoEmotion,
  ElmoGaze,
  OrbPerformanceMetrics,
  OrbWebGLSettings,
} from "./elmo-orb-settings";

export type OrbRendererMode = "svg" | "webgl";

const ElmoOrbWebGL = dynamic(
  () => import("./elmo-orb-webgl").then((module) => module.ElmoOrbWebGL),
  {
    ssr: false,
    loading: () => null,
  },
);

class WebGLErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    onFallback: (reason: string) => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ElmoOrbWebGL fallback", error, info.componentStack);
    this.props.onFallback("Falha ao inicializar o renderer WebGL");
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ElmoOrbRenderer({
  mode,
  state,
  emotion,
  gaze,
  blinkEnabled,
  settings,
  reducedMotion,
  reducedTransparency,
  hasContext,
  onMetrics,
  onFallback,
  initStartedAt,
}: {
  mode: OrbRendererMode;
  state: AssistantState;
  emotion: ElmoEmotion;
  gaze: ElmoGaze;
  blinkEnabled: boolean;
  settings: OrbWebGLSettings;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  hasContext: boolean;
  onMetrics: (metrics: OrbPerformanceMetrics) => void;
  onFallback: (reason: string) => void;
  initStartedAt: number;
}) {
  if (mode === "svg") return <ElmoOrb state={state} />;

  const svgFallback = <ElmoOrb state={state} />;

  return (
    <WebGLErrorBoundary fallback={svgFallback} onFallback={onFallback}>
      <ElmoOrbWebGL
        state={state}
        emotion={emotion}
        gaze={gaze}
        blinkEnabled={blinkEnabled}
        settings={settings}
        reducedMotion={reducedMotion}
        reducedTransparency={reducedTransparency}
        hasContext={hasContext}
        onMetrics={onMetrics}
        onFallback={onFallback}
        initStartedAt={initStartedAt}
      />
    </WebGLErrorBoundary>
  );
}

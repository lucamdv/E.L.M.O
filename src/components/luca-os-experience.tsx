"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AmbientBackdrop } from "@/components/ambient/ambient-backdrop";
import { useAmbient } from "@/components/ambient/ambient-provider";
import {
  ElmoOrbRenderer,
  type OrbRendererMode,
} from "@/components/elmo/elmo-orb-renderer";
import {
  DEFAULT_ORB_SETTINGS,
  ORB_PRESETS,
  type ElmoEmotion,
  type ElmoGaze,
  type OrbPerformanceMetrics,
  type OrbPresetName,
  type OrbWebGLSettings,
} from "@/components/elmo/elmo-orb-settings";
import { ArrowIcon, LocationIcon, MicrophoneIcon, StopIcon } from "@/components/icons";
import { ContextScene } from "@/components/scene/context-scene";
import { MOCK_ENTITIES, RESPONSES, USER_UTTERANCES } from "@/core/mock-data";
import { EMPTY_SCENE, sceneReducer } from "@/core/scene";
import { contrastAuditAt, toHex } from "@/core/ambient";
import type { AssistantState, DemoIntent } from "@/core/types";
import styles from "./luca-os-experience.module.css";

const STATES: AssistantState[] = [
  "IDLE",
  "LISTENING",
  "THINKING",
  "TOOL_EXECUTION",
  "SPEAKING",
  "ERROR",
];

const STATE_NAMES: Record<AssistantState, string> = {
  IDLE: "Repouso",
  LISTENING: "Ouvindo",
  THINKING: "Pensando",
  TOOL_EXECUTION: "Buscando",
  SPEAKING: "Falando",
  ERROR: "Erro",
};

const EMOTIONS: Array<{ value: ElmoEmotion; label: string }> = [
  { value: "neutral", label: "Neutro" },
  { value: "happy", label: "Feliz" },
  { value: "curious", label: "Curioso" },
  { value: "focused", label: "Concentrado" },
  { value: "surprised", label: "Surpreso" },
  { value: "sleepy", label: "Sonolento" },
  { value: "excited", label: "Empolgado" },
  { value: "concerned", label: "Preocupado" },
];

const GAZES: Array<{ value: ElmoGaze; label: string }> = [
  { value: "neutral", label: "Neutro" },
  { value: "user", label: "Usuário" },
  { value: "content", label: "Conteúdo" },
  { value: "anticipate", label: "Antecipar" },
];

const PHASE_SHORTCUTS = [
  { label: "05:30", minute: 330 },
  { label: "08:00", minute: 480 },
  { label: "10:00", minute: 600 },
  { label: "14:00", minute: 840 },
  { label: "16:30", minute: 990 },
  { label: "18:00", minute: 1080 },
  { label: "19:30", minute: 1170 },
  { label: "22:00", minute: 1320 },
] as const;

type NumericOrbSettingKey = {
  [Key in keyof OrbWebGLSettings]: OrbWebGLSettings[Key] extends number ? Key : never;
}[keyof OrbWebGLSettings];

const ORB_CONTROLS: Array<{
  key: NumericOrbSettingKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "transmission", label: "Transmission", min: 0.25, max: 1, step: 0.01 },
  { key: "thickness", label: "Thickness", min: 0.2, max: 3.5, step: 0.05 },
  { key: "ior", label: "IOR", min: 1, max: 2.1, step: 0.01 },
  { key: "roughness", label: "Roughness", min: 0, max: 0.5, step: 0.01 },
  { key: "chromaticAberration", label: "Chromatic aberration", min: 0, max: 0.08, step: 0.002 },
  { key: "distortion", label: "Distortion", min: 0, max: 0.5, step: 0.01 },
  { key: "temporalDistortion", label: "Temporal distortion", min: 0, max: 0.2, step: 0.005 },
  { key: "environmentIntensity", label: "Environment", min: 0.2, max: 2, step: 0.05 },
  { key: "innerLightIntensity", label: "Inner light", min: 0, max: 1.5, step: 0.05 },
  { key: "deformationAmplitude", label: "Deformation", min: 0, max: 0.08, step: 0.002 },
  { key: "deformationSpeed", label: "Deformation speed", min: 0, max: 0.6, step: 0.01 },
  { key: "innerMovementSpeed", label: "Inner movement", min: 0, max: 0.6, step: 0.01 },
  { key: "innerDensity", label: "Inner density", min: 0.1, max: 0.9, step: 0.01 },
  { key: "faceIntensity", label: "Face intensity", min: 0.35, max: 1.35, step: 0.01 },
  { key: "faceDepth", label: "Face depth", min: 0, max: 0.55, step: 0.01 },
  { key: "internalMatterIntensity", label: "Internal matter", min: 0.2, max: 1.2, step: 0.01 },
  { key: "internalParallax", label: "Internal parallax", min: 0, max: 1, step: 0.01 },
  { key: "shellRefraction", label: "Shell refraction", min: 0, max: 1, step: 0.01 },
  { key: "shellDensity", label: "Shell density", min: 0.1, max: 1, step: 0.01 },
  { key: "fresnel", label: "Fresnel", min: 0.1, max: 1.4, step: 0.01 },
  { key: "faceSafeZone", label: "Face safe zone", min: 0.25, max: 1.1, step: 0.01 },
];

function inferIntent(value: string): DemoIntent {
  const normalized = value.toLocaleLowerCase("pt-BR");
  if (normalized.includes("tempo") || normalized.includes("chuva")) return "weather";
  if (
    normalized.includes("compromisso") ||
    normalized.includes("agenda") ||
    normalized.includes("tarde")
  ) {
    return "calendar";
  }
  if (normalized.includes("e-mail") || normalized.includes("email")) return "gmail";
  if (normalized.includes("erro") || normalized.includes("falha")) return "error";
  return "morning";
}

export function LucaOSExperience() {
  const ambient = useAmbient();
  const setManualMinute = ambient.setManualMinute;
  const setManualMinuteRef = useRef(setManualMinute);
  const [assistantState, setAssistantState] = useState<AssistantState>("IDLE");
  const [emotion, setEmotion] = useState<ElmoEmotion>("neutral");
  const [gaze, setGaze] = useState<ElmoGaze>("neutral");
  const [blinkEnabled, setBlinkEnabled] = useState(true);
  const [scene, dispatchScene] = useReducer(sceneReducer, EMPTY_SCENE);
  const [input, setInput] = useState("");
  const [userTranscript, setUserTranscript] = useState<string | null>(null);
  const [assistantTranscript, setAssistantTranscript] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedTransparency, setReducedTransparency] = useState(false);
  const [orbMode, setOrbMode] = useState<OrbRendererMode>("webgl");
  const [orbPreset, setOrbPreset] = useState<OrbPresetName | "custom">("liquid");
  const [orbSettings, setOrbSettings] = useState<OrbWebGLSettings>(() => ({
    ...DEFAULT_ORB_SETTINGS,
  }));
  const [orbMetrics, setOrbMetrics] = useState<OrbPerformanceMetrics | null>(null);
  const [orbFallbackMessage, setOrbFallbackMessage] = useState<string | null>(null);
  const [webglRequestedAt, setWebglRequestedAt] = useState(() =>
    typeof performance === "undefined" ? 0 : performance.now(),
  );
  const timers = useRef<number[]>([]);
  const didApplyLabUrl = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    setManualMinuteRef.current = setManualMinute;
  }, [setManualMinute]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const timeout = window.setTimeout(() => {
      if (didApplyLabUrl.current) return;
      didApplyLabUrl.current = true;
      const params = new URLSearchParams(window.location.search);
      const time = params.get("time");
      if (time) {
        const [hours, minutes = "0"] = time.split(":");
        const minute = Number(hours) * 60 + Number(minutes);
        if (Number.isFinite(minute) && minute >= 0 && minute < 1440) {
          setManualMinuteRef.current(minute);
        }
      }
      if (params.get("orb") === "svg") {
        setOrbMode("svg");
      } else if (params.get("orb") === "webgl") {
        setWebglRequestedAt(performance.now());
        setOrbMode("webgl");
      }
      const requestedEmotion = params.get("emotion") as ElmoEmotion | null;
      if (requestedEmotion && EMOTIONS.some((item) => item.value === requestedEmotion)) {
        setEmotion(requestedEmotion);
      }
      const requestedGaze = params.get("gaze") as ElmoGaze | null;
      if (requestedGaze && GAZES.some((item) => item.value === requestedGaze)) {
        setGaze(requestedGaze);
      }
      if (params.get("scene") === "morning") {
        setUserTranscript(USER_UTTERANCES.morning);
        setAssistantTranscript(RESPONSES.morning);
        dispatchScene({ type: "present", entity: MOCK_ENTITIES.calendar, role: "primary" });
        dispatchScene({ type: "present", entity: MOCK_ENTITIES.weather, role: "secondary" });
        dispatchScene({ type: "present", entity: MOCK_ENTITIES.gmail, role: "secondary" });
        setAssistantState("SPEAKING");
        setEmotion("happy");
        setGaze("content");
      }
      const requestedState = params.get("state") as AssistantState | null;
      if (requestedState && STATES.includes(requestedState)) {
        setAssistantState(requestedState);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const applyIntent = useCallback((intent: DemoIntent) => {
    if (intent === "error") {
      setAssistantState("ERROR");
      setEmotion("concerned");
      setGaze("user");
      setAssistantTranscript(RESPONSES.error);
      return;
    }

    if (intent === "morning") {
      dispatchScene({ type: "present", entity: MOCK_ENTITIES.calendar, role: "primary" });
      dispatchScene({ type: "present", entity: MOCK_ENTITIES.weather, role: "secondary" });
      dispatchScene({ type: "present", entity: MOCK_ENTITIES.gmail, role: "secondary" });
    } else {
      const entity = MOCK_ENTITIES[intent];
      dispatchScene({ type: "present", entity, role: "primary" });
      dispatchScene({ type: "promote", stableId: entity.stableId });
    }

    setAssistantState("SPEAKING");
    setEmotion(intent === "morning" ? "happy" : "neutral");
    setGaze("content");
    setAssistantTranscript(RESPONSES[intent]);
  }, []);

  const runIntent = useCallback(
    (intent: DemoIntent, utterance: string = USER_UTTERANCES[intent]) => {
      clearTimers();
      setUserTranscript(utterance);
      setAssistantTranscript(null);
      setAssistantState("LISTENING");
      setEmotion("focused");
      setGaze("user");

      timers.current.push(
        window.setTimeout(() => {
          setAssistantState("THINKING");
          setEmotion("curious");
          setGaze("neutral");
        }, 420),
        window.setTimeout(() => {
          setAssistantState("TOOL_EXECUTION");
          setEmotion("focused");
          setGaze("anticipate");
        }, 980),
        window.setTimeout(() => applyIntent(intent), 1250),
        window.setTimeout(() => {
          setAssistantState((current) => current === "SPEAKING" ? "IDLE" : current);
          setEmotion("neutral");
          setGaze("neutral");
        }, 6200),
      );
    },
    [applyIntent, clearTimers],
  );

  const interrupt = useCallback(() => {
    clearTimers();
    setAssistantState("LISTENING");
    setEmotion("focused");
    setGaze("user");
    setUserTranscript("Só me fala os da tarde.");
    setAssistantTranscript(null);
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setAssistantState("IDLE");
    setEmotion("neutral");
    setGaze("neutral");
    setUserTranscript(null);
    setAssistantTranscript(null);
    setInput("");
    dispatchScene({ type: "clear" });
  }, [clearTimers]);

  const handleOrbFallback = useCallback((reason: string) => {
    setOrbFallbackMessage(reason);
    setOrbMode("svg");
  }, []);

  const selectOrbPreset = useCallback((preset: OrbPresetName) => {
    setOrbPreset(preset);
    setOrbSettings({ ...ORB_PRESETS[preset] });
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    runIntent(inferIntent(value), value);
    setInput("");
  }

  const hasContext = scene.entities.length > 0;
  const isSpeaking = assistantState === "SPEAKING";
  const contrastAudit = contrastAuditAt(ambient.minute);
  const colorDebug = [
    ["backgroundLeft", toHex(ambient.tokens.backgroundLeft)],
    ["backgroundCenter", toHex(ambient.tokens.backgroundCenter)],
    ["backgroundRight", toHex(ambient.tokens.backgroundRight)],
    ["elmoCore", toHex(ambient.tokens.elmoCore)],
    ["elmoRim", toHex(ambient.tokens.elmoRim)],
    ["elmoHighlight", toHex(ambient.tokens.elmoHighlight)],
    ["Background luminance", ambient.tokens.estimatedBackgroundLuminance.toFixed(3)],
    ["Elmo luminance", ambient.tokens.estimatedElmoLuminance.toFixed(3)],
    ["Contrast delta", ambient.tokens.contrastDelta.toFixed(3)],
    ["Safeguard", ambient.tokens.safeguardActive ? `ativo · ${ambient.tokens.safeguardStrength.toFixed(2)}` : "inativo"],
  ] as const;

  return (
    <main
      className={styles.shell}
      style={ambient.style}
      data-phase={ambient.phase}
      data-minute={ambient.minute}
      data-has-context={hasContext}
      data-reduced-motion={reducedMotion}
      data-reduced-transparency={reducedTransparency}
      data-orb-kind={orbMode}
    >
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <AmbientBackdrop />

      <header className={styles.header}>
        <div className={styles.identity} aria-label="Elmo, assistente do Luca OS">
          <span>Elmo</span>
        </div>
        <div className={styles.localContext}>
          <span>
            <LocationIcon />
            Recife, PE
          </span>
          <time dateTime={ambient.timeLabel}>{ambient.timeLabel}</time>
        </div>
      </header>

      <section className={styles.conversation} aria-label="Conversa com Elmo">
        <AnimatePresence mode="wait">
          {(userTranscript || assistantTranscript) && (
            <motion.div
              className={styles.transcript}
              key={`${userTranscript}-${assistantTranscript}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", bounce: 0, duration: 0.34 }}
              aria-live="polite"
            >
              {userTranscript && <p className={styles.userLine}>{userTranscript}</p>}
              {assistantTranscript && <p className={styles.elmoLine}>{assistantTranscript}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={styles.orbAnchor}
          layout
          transition={{ layout: { type: "spring", bounce: 0, duration: 0.4 } }}
        >
          <ElmoOrbRenderer
            mode={orbMode}
            state={assistantState}
            emotion={emotion}
            gaze={gaze}
            blinkEnabled={blinkEnabled}
            settings={orbSettings}
            reducedMotion={reducedMotion}
            reducedTransparency={reducedTransparency}
            hasContext={hasContext}
            onMetrics={setOrbMetrics}
            onFallback={handleOrbFallback}
            initStartedAt={webglRequestedAt}
          />
        </motion.div>

        <ContextScene entities={scene.entities} />
      </section>

      <form className={styles.composer} onSubmit={submit}>
        <label className={styles.srOnly} htmlFor="elmo-input">
          Fale ou escreva para o Elmo
        </label>
        <input
          id="elmo-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Fale ou escreva para o Elmo…"
          autoComplete="off"
        />
        {input ? (
          <button className={styles.sendButton} type="submit" aria-label="Enviar mensagem">
            <ArrowIcon />
          </button>
        ) : (
          <button
            className={styles.voiceButton}
            type="button"
            aria-label={isSpeaking ? "Interromper o Elmo e começar a ouvir" : "Ativar microfone"}
            onClick={() => (isSpeaking ? interrupt() : runIntent("morning"))}
          >
            {isSpeaking ? <StopIcon /> : <MicrophoneIcon />}
          </button>
        )}
      </form>

      <details className={styles.lab}>
        <summary>Laboratório</summary>
        <div className={styles.labBody}>
          <p>Dados locais de desenvolvimento</p>

          <fieldset>
            <legend>Ambiente</legend>
            <div className={styles.buttonRow}>
              {PHASE_SHORTCUTS.map((phase) => (
                <button key={phase.label} type="button" onClick={() => ambient.setManualMinute(phase.minute)}>
                  {phase.label}
                </button>
              ))}
              <button type="button" onClick={() => ambient.setManualMinute(null)}>
                Agora
              </button>
            </div>
            <label className={styles.sliderLabel}>
              Horário: {ambient.timeLabel}
              <input
                type="range"
                min="0"
                max="1439"
                step="15"
                value={ambient.minute}
                onChange={(event) => ambient.setManualMinute(Number(event.target.value))}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Estado do Elmo</legend>
            <div className={styles.buttonRow}>
              {STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  aria-pressed={assistantState === state}
                  onClick={() => {
                    clearTimers();
                    setAssistantState(state);
                  }}
                >
                  {STATE_NAMES[state]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Orb renderer</legend>
            <div className={styles.buttonRow}>
              <button
                type="button"
                aria-pressed={orbMode === "svg"}
                onClick={() => setOrbMode("svg")}
              >
                SVG
              </button>
              <button
                type="button"
                aria-pressed={orbMode === "webgl"}
                onClick={() => {
                  setOrbFallbackMessage(null);
                  setWebglRequestedAt(performance.now());
                  setOrbMode("webgl");
                }}
              >
                WebGL
              </button>
              <button
                type="button"
                aria-label="Prototype reference mode: Elmo neutro, em repouso, às 22 horas"
                onClick={() => {
                  reset();
                  ambient.setManualMinute(1320);
                  setOrbFallbackMessage(null);
                  setWebglRequestedAt(performance.now());
                  setOrbMode("webgl");
                }}
              >
                Prototype reference mode
              </button>
            </div>
            {orbFallbackMessage && (
              <p className={styles.fallbackNotice} role="status">
                {orbFallbackMessage}. SVG reativado.
              </p>
            )}

            {orbMode === "webgl" && (
              <div className={styles.orbLab}>
                <div>
                  <p>Emoção</p>
                  <div className={styles.buttonRow} aria-label="Emoção do Elmo">
                    {EMOTIONS.map((item) => (
                      <button key={item.value} type="button" aria-pressed={emotion === item.value} onClick={() => setEmotion(item.value)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p>Olhar</p>
                  <div className={styles.buttonRow} aria-label="Direção do olhar">
                    {GAZES.map((item) => (
                      <button key={item.value} type="button" aria-pressed={gaze === item.value} onClick={() => setGaze(item.value)}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className={styles.orbControl}>
                  <span>Blink irregular</span>
                  <input type="checkbox" checked={blinkEnabled} onChange={(event) => setBlinkEnabled(event.target.checked)} />
                </label>

                <label className={styles.orbControl}>
                  <span>Olhar segue o cursor · laboratório</span>
                  <input
                    type="checkbox"
                    checked={orbSettings.followCursor}
                    onChange={(event) => {
                      setOrbPreset("custom");
                      setOrbSettings((current) => ({
                        ...current,
                        followCursor: event.target.checked,
                      }));
                    }}
                  />
                </label>

                <div className={styles.buttonRow} aria-label="Presets ópticos">
                  {(Object.keys(ORB_PRESETS) as OrbPresetName[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={orbPreset === preset}
                      onClick={() => selectOrbPreset(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className={styles.orbControls}>
                  {ORB_CONTROLS.map((control) => (
                    <label key={control.key} className={styles.orbControl}>
                      <span>
                        {control.label}
                        <output>{orbSettings[control.key].toFixed(control.step < 0.01 ? 3 : 2)}</output>
                      </span>
                      <input
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={orbSettings[control.key]}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setOrbPreset("custom");
                          setOrbSettings((current) => ({
                            ...current,
                            [control.key]: value,
                          }));
                        }}
                      />
                    </label>
                  ))}
                </div>

                {orbMetrics && (
                  <>
                    <dl className={styles.labMetrics} aria-label="Métricas WebGL">
                      <div><dt>FPS</dt><dd>{orbMetrics.fps}</dd></div>
                      <div><dt>Frame</dt><dd>{orbMetrics.frameTimeMs} ms</dd></div>
                      <div><dt>Draw calls</dt><dd>{orbMetrics.drawCalls}</dd></div>
                      <div><dt>Triangles</dt><dd>{orbMetrics.triangles.toLocaleString("pt-BR")}</dd></div>
                      <div><dt>DPR</dt><dd>{orbMetrics.dpr}</dd></div>
                      <div><dt>Init</dt><dd>{orbMetrics.initTimeMs} ms</dd></div>
                    </dl>
                    {orbMetrics.sampleLimited && (
                      <p className={styles.metricNotice} role="status">
                        Amostra limitada por throttling do navegador; compare em uma aba ativa.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Foreground adaptativo</legend>
            <dl className={styles.contrastGrid} aria-label="Contraste representativo">
              <div><dt>Primary</dt><dd>{contrastAudit.primary.toFixed(2)}:1</dd></div>
              <div><dt>Secondary</dt><dd>{contrastAudit.secondary.toFixed(2)}:1</dd></div>
              <div><dt>Tertiary</dt><dd>{contrastAudit.tertiary.toFixed(2)}:1</dd></div>
              <div><dt>On material</dt><dd>{contrastAudit.onMaterial.toFixed(2)}:1</dd></div>
            </dl>
            <p className={styles.metricNotice}>
              Stop {ambient.tokens.fromTime} → {ambient.tokens.toTime} · {(ambient.tokens.progress * 100).toFixed(0)}%
            </p>
            <dl className={styles.colorDebug} aria-label="Debug cromático do ambiente e do Elmo">
              {colorDebug.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </fieldset>

          <fieldset>
            <legend>Cenas</legend>
            <div className={styles.buttonRow}>
              <button type="button" onClick={() => runIntent("morning")}>Bom dia</button>
              <button type="button" onClick={() => runIntent("weather")}>Tempo</button>
              <button type="button" onClick={() => runIntent("calendar")}>Agenda</button>
              <button type="button" onClick={() => runIntent("gmail")}>E-mail</button>
              <button type="button" onClick={interrupt}>Interromper</button>
              <button type="button" onClick={reset}>Reiniciar</button>
            </div>
          </fieldset>

          <div className={styles.preferences}>
            <label>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.target.checked)}
              />
              Movimento reduzido
            </label>
            <label>
              <input
                type="checkbox"
                checked={reducedTransparency}
                onChange={(event) => setReducedTransparency(event.target.checked)}
              />
              Transparência reduzida
            </label>
          </div>
        </div>
      </details>
      </MotionConfig>
    </main>
  );
}

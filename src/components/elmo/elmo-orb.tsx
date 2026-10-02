"use client";

import { motion } from "motion/react";
import type { AssistantState } from "@/core/types";
import { ELMO_STATE_LABELS } from "./elmo-state";
import styles from "./elmo-orb.module.css";

const PATHS: Record<AssistantState, string> = {
  IDLE:
    "M120 14 C178 12 220 54 226 112 C232 169 190 223 127 227 C64 231 16 190 14 128 C12 65 54 17 120 14 Z",
  LISTENING:
    "M120 8 C184 11 228 49 231 110 C234 174 191 229 126 233 C59 236 9 192 9 126 C9 58 54 12 120 8 Z",
  THINKING:
    "M122 15 C180 5 225 58 226 111 C229 166 199 220 132 228 C65 236 18 195 13 132 C8 69 58 26 122 15 Z",
  TOOL_EXECUTION:
    "M115 17 C176 8 230 43 235 104 C241 164 197 213 132 223 C68 233 18 198 10 137 C2 75 49 26 115 17 Z",
  SPEAKING:
    "M119 10 C180 18 221 45 231 105 C241 168 187 219 130 231 C65 242 15 190 10 130 C5 67 57 3 119 10 Z",
  ERROR:
    "M121 29 C170 24 207 63 211 113 C215 164 181 205 130 211 C78 217 37 185 29 135 C21 84 67 35 121 29 Z",
};

export function ElmoOrb({ state }: { state: AssistantState }) {
  const label = ELMO_STATE_LABELS[state];

  return (
    <figure
      className={styles.figure}
      data-state={state}
      role="img"
      aria-label={`Elmo: ${label}`}
    >
      <motion.div
        className={styles.orb}
        animate={{
          scale: state === "LISTENING" ? 1.035 : state === "ERROR" ? 0.94 : 1,
          rotate: state === "THINKING" ? -2.5 : state === "SPEAKING" ? 1.5 : 0,
        }}
        transition={{ type: "spring", bounce: 0, duration: 0.38 }}
      >
        <svg
          className={styles.svg}
          viewBox="0 0 240 240"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="elmo-core" cx="35%" cy="24%" r="78%">
              <stop offset="0%" stopColor="var(--orb-highlight)" stopOpacity="0.74" />
              <stop offset="29%" stopColor="var(--orb-light)" stopOpacity="0.18" />
              <stop offset="68%" stopColor="var(--orb-depth)" stopOpacity="var(--orb-density)" />
              <stop offset="100%" stopColor="var(--ambient-background-deep)" stopOpacity="0.66" />
            </radialGradient>
            <linearGradient id="elmo-rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.86" />
              <stop offset="31%" stopColor="var(--ambient-sunlight)" stopOpacity="0.42" />
              <stop offset="69%" stopColor="var(--orb-depth)" stopOpacity="0.62" />
              <stop offset="100%" stopColor="var(--ambient-light)" stopOpacity="0.28" />
            </linearGradient>
            <radialGradient id="elmo-warm-volume" cx="28%" cy="28%" r="86%">
              <stop offset="0%" stopColor="var(--ambient-sunlight)" stopOpacity="0.68" />
              <stop offset="58%" stopColor="var(--ambient-horizon)" stopOpacity="0.17" />
              <stop offset="100%" stopColor="var(--ambient-background-deep)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="elmo-cool-volume" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.12" />
              <stop offset="48%" stopColor="var(--ambient-light)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--ambient-background-deep)" stopOpacity="0.12" />
            </linearGradient>
            <clipPath id="elmo-volume-clip">
              <path d={PATHS.IDLE} />
            </clipPath>
            <filter id="elmo-soft-volume" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="8" />
            </filter>
            <filter id="elmo-soft-caustic" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>

          <motion.path
            className={styles.membrane}
            d={PATHS.IDLE}
            animate={{ d: PATHS[state] }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            fill="url(#elmo-core)"
            stroke="url(#elmo-rim)"
          />
          <motion.g
            className={styles.innerSystem}
            clipPath="url(#elmo-volume-clip)"
            animate={{
              rotate:
                state === "THINKING"
                  ? 18
                  : state === "TOOL_EXECUTION"
                    ? 8
                    : state === "ERROR"
                      ? -8
                      : 0,
              x: state === "TOOL_EXECUTION" ? 8 : 0,
            }}
            transition={{ type: "spring", bounce: 0, duration: 0.36 }}
            style={{ transformOrigin: "120px 120px" }}
          >
            <path
              className={styles.warmVolume}
              d="M33 111 C45 51 99 28 145 42 C185 55 208 92 189 123 C170 154 120 151 89 181 C62 207 20 173 33 111 Z"
              fill="url(#elmo-warm-volume)"
              filter="url(#elmo-soft-volume)"
            />
            <path
              className={styles.coolVolume}
              d="M82 28 C133 18 202 57 211 116 C219 169 165 216 116 211 C76 207 69 178 91 148 C114 116 73 92 82 28 Z"
              fill="url(#elmo-cool-volume)"
              filter="url(#elmo-soft-volume)"
            />
            <path
              className={styles.denseMembrane}
              d="M54 154 C69 116 105 96 141 101 C171 105 194 125 190 151 C185 185 144 207 105 198 C76 191 43 181 54 154 Z"
            />
            <g className={styles.filamentField}>
              <path d="M48 137 C76 120 78 78 113 57 C142 39 177 50 199 78" />
              <path d="M55 171 C87 139 128 143 155 114 C174 94 184 70 181 49" />
              <path d="M75 49 C91 82 126 88 145 117 C164 145 159 177 139 203" />
              <path d="M42 109 C82 98 111 112 134 145 C151 168 176 177 204 164" />
              <path d="M91 211 C91 174 75 151 82 124 C92 87 133 69 173 79" />
            </g>
            <g className={styles.causticField} filter="url(#elmo-soft-caustic)">
              <path d="M41 103 C67 57 111 37 151 46 C111 51 72 78 57 121 Z" />
              <path d="M83 194 C124 207 173 185 195 145 C176 180 135 188 101 176 Z" />
              <path d="M164 58 C193 80 208 109 201 138 C196 111 180 92 154 80 Z" />
            </g>
            <ellipse className={styles.internalLens} cx="111" cy="112" rx="39" ry="26" transform="rotate(-21 111 112)" />
            <path
              className={styles.lightWell}
              d="M78 95 C98 69 135 59 160 76 C178 89 169 108 146 113 C120 119 102 143 77 132 C61 125 64 112 78 95 Z"
            />
          </motion.g>
          <g className={styles.specularField}>
            <ellipse cx="82" cy="54" rx="27" ry="9" transform="rotate(-31 82 54)" />
            <path d="M43 92 C54 60 74 40 103 31" />
            <ellipse cx="184" cy="145" rx="8" ry="21" transform="rotate(31 184 145)" />
          </g>
        </svg>
        <div className={styles.directionalPulse} />
      </motion.div>
      <figcaption className={styles.caption} aria-live="polite">
        <span className={styles.stateMark} aria-hidden="true" />
        {label}
      </figcaption>
    </figure>
  );
}

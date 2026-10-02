"use client";

import { AnimatePresence, motion } from "motion/react";
import type {
  CalendarContent,
  GmailContent,
  SceneEntity,
  WeatherContent,
} from "@/core/types";
import styles from "./context-scene.module.css";

const PLACEMENT_OFFSETS = {
  primary: { x: -250, y: 70 },
  "secondary-a": { x: -410, y: 170 },
  "secondary-b": { x: -360, y: -90 },
} as const;

function WeatherView({
  content,
  primary,
}: {
  content: WeatherContent;
  primary: boolean;
}) {
  return (
    <div className={styles.weather} data-primary={primary}>
      <div className={styles.eyebrow}>Amanhã · {content.location}</div>
      <div className={styles.temperature}>
        {content.temperature}
        <span>°</span>
      </div>
      <p>{content.condition}</p>
      <dl className={styles.weatherFacts}>
        <div>
          <dt>Mínima</dt>
          <dd>{content.minimum}°</dd>
        </div>
        <div>
          <dt>Chuva</dt>
          <dd>{content.rainChance}%</dd>
        </div>
      </dl>
    </div>
  );
}

function CalendarView({
  content,
  primary,
}: {
  content: CalendarContent;
  primary: boolean;
}) {
  return (
    <div className={styles.calendar} data-primary={primary}>
      <div className={styles.eyebrow}>{content.dateLabel}</div>
      <h2>{content.items.length} compromissos</h2>
      <ol>
        {content.items.map((item) => (
          <li key={item.id}>
            <time>{item.time}</time>
            <span>{item.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GmailView({
  content,
  primary,
}: {
  content: GmailContent;
  primary: boolean;
}) {
  return (
    <div className={styles.gmail} data-primary={primary}>
      <div className={styles.eyebrow}>E-mails para observar</div>
      <h2>{content.items.length} podem pedir atenção</h2>
      <ul>
        {content.items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.sender}</strong>
              <span>{item.subject}</span>
            </div>
            <time>{item.time}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntityView({ entity }: { entity: SceneEntity }) {
  const primary = entity.role === "primary";

  switch (entity.content.kind) {
    case "weather":
      return <WeatherView content={entity.content} primary={primary} />;
    case "calendar":
      return <CalendarView content={entity.content} primary={primary} />;
    case "gmail":
      return <GmailView content={entity.content} primary={primary} />;
  }
}

export function ContextScene({ entities }: { entities: SceneEntity[] }) {
  return (
    <section className={styles.scene} aria-label="Contexto ativo da conversa">
      <AnimatePresence mode="popLayout">
        {entities.map((entity) => {
          const offset = PLACEMENT_OFFSETS[entity.currentPlacement];
          return (
            <motion.article
              key={entity.stableId}
              layoutId={entity.stableId}
              className={styles.entity}
              data-placement={entity.currentPlacement}
              data-role={entity.role}
              data-capability={entity.capability}
              aria-label={entity.accessibilitySummary}
              initial={{
                opacity: 0,
                scale: 0.78,
                x: offset.x,
                y: offset.y,
                filter: "blur(14px)",
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0,
                filter: "blur(0px)",
              }}
              exit={{
                opacity: 0,
                scale: 0.82,
                x: offset.x * 0.45,
                y: offset.y * 0.45,
                filter: "blur(12px)",
              }}
              transition={{
                layout: { type: "spring", bounce: 0, duration: 0.4 },
                opacity: { duration: 0.22 },
                filter: { duration: 0.26 },
                default: { type: "spring", bounce: 0, duration: 0.38 },
              }}
            >
              <EntityView entity={entity} />
            </motion.article>
          );
        })}
      </AnimatePresence>
    </section>
  );
}

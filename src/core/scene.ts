import type {
  SceneEntity,
  SceneOperation,
  ScenePlacement,
  SceneRole,
  SceneState,
} from "./types";

export const EMPTY_SCENE: SceneState = { entities: [], turn: 0 };

const ROLE_RELEVANCE: Record<SceneRole, number> = {
  primary: 1,
  secondary: 0.72,
  compact: 0.45,
};

function allocate(entities: SceneEntity[], focusedId?: string): SceneEntity[] {
  const ordered = [...entities].sort((a, b) => {
    if (a.stableId === focusedId) return -1;
    if (b.stableId === focusedId) return 1;
    return b.relevance - a.relevance;
  });

  const placements: ScenePlacement[] = [
    "primary",
    "secondary-a",
    "secondary-b",
  ];

  return ordered.slice(0, 3).map((entity, index) => {
    const currentPlacement = placements[index];
    const role: SceneRole = index === 0 ? "primary" : "secondary";

    return {
      ...entity,
      role,
      relevance:
        entity.stableId === focusedId
          ? ROLE_RELEVANCE.primary
          : Math.min(entity.relevance, ROLE_RELEVANCE.secondary),
      previousPlacement:
        entity.currentPlacement === currentPlacement
          ? entity.previousPlacement
          : entity.currentPlacement,
      currentPlacement,
      lifecycle: "active",
    };
  });
}

export function sceneReducer(
  state: SceneState,
  operation: SceneOperation,
): SceneState {
  if (operation.type === "clear") return EMPTY_SCENE;

  const turn = state.turn + 1;

  if (operation.type === "promote") {
    const entities = state.entities.map((entity) => ({
      ...entity,
      relevance:
        entity.stableId === operation.stableId
          ? ROLE_RELEVANCE.primary
          : Math.max(0.35, entity.relevance * 0.86),
      lastReferencedTurn:
        entity.stableId === operation.stableId
          ? turn
          : entity.lastReferencedTurn,
    }));

    return {
      entities: allocate(entities, operation.stableId),
      focusedId: operation.stableId,
      turn,
    };
  }

  const existing = state.entities.find(
    (entity) => entity.stableId === operation.entity.stableId,
  );

  const nextEntity: SceneEntity = {
    ...operation.entity,
    relevance: ROLE_RELEVANCE[operation.role],
    role: operation.role,
    lifecycle: existing ? "active" : "entering",
    previousPlacement: existing?.currentPlacement,
    currentPlacement: existing?.currentPlacement ?? "primary",
    lastReferencedTurn: turn,
  };

  const entities = existing
    ? state.entities.map((entity) =>
        entity.stableId === nextEntity.stableId ? nextEntity : entity,
      )
    : [...state.entities, nextEntity];

  const focusedId =
    operation.role === "primary"
      ? nextEntity.stableId
      : state.focusedId ?? nextEntity.stableId;

  return {
    entities: allocate(entities, focusedId),
    focusedId,
    turn,
  };
}

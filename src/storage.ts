import type { CloudState, FitFlowState } from "./types";

export type StorageScope = "demo" | `user:${string}`;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type CloudWriteResult =
  | { status: "saved"; version: number }
  | { status: "conflict"; version: number };

export type CloudStateWriter = (
  state: FitFlowState,
  expectedVersion: number,
) => Promise<CloudWriteResult>;

const STORAGE_PREFIX = "fitflow-state";
const LEGACY_MIGRATION_KEY = `${STORAGE_PREFIX}:legacy-migrated`;

const legacyKeys = {
  profile: "fitflow-profile",
  routines: "fitflow-routines",
  workouts: "fitflow-workouts",
  calories: "fitflow-calories",
  onboarded: "fitflow-onboarded",
} as const;

const parse = <T>(value: string | null): T | undefined => {
  if (value === null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

export const storageKeyForScope = (scope: StorageScope) => `${STORAGE_PREFIX}:${scope}`;

export const userStorageScope = (userId: string): StorageScope => `user:${userId}`;

export const migrateLegacyStateToDemo = (
  storage: StorageLike,
  fallback: FitFlowState,
): FitFlowState => {
  const existing = parse<FitFlowState>(storage.getItem(storageKeyForScope("demo")));
  if (existing) {
    storage.setItem(LEGACY_MIGRATION_KEY, "true");
    Object.values(legacyKeys).forEach(key => storage.removeItem(key));
    return existing;
  }

  if (storage.getItem(LEGACY_MIGRATION_KEY)) return fallback;

  const migrated: FitFlowState = {
    profile: parse(storage.getItem(legacyKeys.profile)) ?? fallback.profile,
    routines: parse(storage.getItem(legacyKeys.routines)) ?? fallback.routines,
    workouts: parse(storage.getItem(legacyKeys.workouts)) ?? fallback.workouts,
    calories: parse(storage.getItem(legacyKeys.calories)) ?? fallback.calories,
    progressionDecisions: fallback.progressionDecisions,
    onboarded: parse(storage.getItem(legacyKeys.onboarded)) ?? fallback.onboarded,
  };

  storage.setItem(storageKeyForScope("demo"), JSON.stringify(migrated));
  storage.setItem(LEGACY_MIGRATION_KEY, "true");
  Object.values(legacyKeys).forEach(key => storage.removeItem(key));
  return migrated;
};

export const loadScopedState = (
  storage: StorageLike,
  scope: StorageScope,
  fallback: FitFlowState,
): FitFlowState => {
  if (scope === "demo") migrateLegacyStateToDemo(storage, fallback);
  const saved = parse<FitFlowState>(storage.getItem(storageKeyForScope(scope)));
  return saved ? { ...saved, progressionDecisions: saved.progressionDecisions ?? [] } : fallback;
};

export const saveScopedState = (
  storage: StorageLike,
  scope: StorageScope,
  state: FitFlowState,
) => {
  storage.setItem(storageKeyForScope(scope), JSON.stringify(state));
};

export const clearScopedState = (storage: StorageLike, scope: StorageScope) => {
  storage.removeItem(storageKeyForScope(scope));
};

export const createCloudStateQueue = (
  initialVersion: number,
  write: CloudStateWriter,
) => {
  let version = initialVersion;
  let conflicted = false;
  let tail = Promise.resolve<CloudWriteResult>({ status: "saved", version });

  const enqueue = (state: FitFlowState): Promise<CloudWriteResult> => {
    tail = tail.then(async () => {
      if (conflicted) return { status: "conflict", version };
      const result = await write(state, version);
      version = result.version;
      conflicted = result.status === "conflict";
      return result;
    });
    return tail;
  };

  return {
    enqueue,
    getVersion: () => version,
    hasConflict: () => conflicted,
    reset: (cloudState: CloudState) => {
      version = cloudState.version;
      conflicted = false;
    },
  };
};

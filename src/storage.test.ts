import { describe, expect, it } from "vitest";
import {
  createCloudStateQueue,
  loadScopedState,
  migrateLegacyStateToDemo,
  saveScopedState,
  storageKeyForScope,
  userStorageScope,
  type StorageLike,
} from "./storage";
import type { FitFlowState } from "./types";

const state = (name: string): FitFlowState => ({
  profile: {
    name, age: 30, height: 175, weight: 80, targetWeight: 75,
    goal: "Build muscle", experience: "Intermediate", frequency: 3,
    equipment: ["Dumbbell"], injuries: "",
  },
  routines: [],
  workouts: [],
  calories: [],
  onboarded: true,
});

const memoryStorage = (): StorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

describe("scoped local state", () => {
  it("keeps demo and authenticated users isolated", () => {
    const storage = memoryStorage();
    saveScopedState(storage, "demo", state("Demo"));
    saveScopedState(storage, userStorageScope("user-a"), state("User A"));
    saveScopedState(storage, userStorageScope("user-b"), state("User B"));

    expect(loadScopedState(storage, "demo", state("Fallback")).profile.name).toBe("Demo");
    expect(loadScopedState(storage, userStorageScope("user-a"), state("Fallback")).profile.name).toBe("User A");
    expect(loadScopedState(storage, userStorageScope("user-b"), state("Fallback")).profile.name).toBe("User B");
  });

  it("migrates legacy keys to demo exactly once and removes personal legacy data", () => {
    const storage = memoryStorage();
    storage.setItem("fitflow-profile", JSON.stringify(state("Legacy").profile));
    storage.setItem("fitflow-onboarded", JSON.stringify(true));

    expect(migrateLegacyStateToDemo(storage, state("Fallback")).profile.name).toBe("Legacy");
    expect(storage.getItem("fitflow-profile")).toBeNull();
    expect(storage.getItem(storageKeyForScope("demo"))).not.toBeNull();

    storage.setItem("fitflow-profile", JSON.stringify(state("Late legacy").profile));
    expect(migrateLegacyStateToDemo(storage, state("Fallback")).profile.name).toBe("Legacy");
  });
});

describe("versioned cloud queue", () => {
  it("serializes writes and advances the expected version", async () => {
    const expectedVersions: number[] = [];
    const queue = createCloudStateQueue(3, async (_next, expectedVersion) => {
      expectedVersions.push(expectedVersion);
      return { status: "saved", version: expectedVersion + 1 };
    });

    await Promise.all([queue.enqueue(state("First")), queue.enqueue(state("Second"))]);
    expect(expectedVersions).toEqual([3, 4]);
    expect(queue.getVersion()).toBe(5);
  });

  it("stops later writes after a conflict until reset", async () => {
    let calls = 0;
    const queue = createCloudStateQueue(2, async () => {
      calls += 1;
      return { status: "conflict", version: 7 };
    });

    expect(await queue.enqueue(state("Conflict"))).toEqual({ status: "conflict", version: 7 });
    expect(await queue.enqueue(state("Blocked"))).toEqual({ status: "conflict", version: 7 });
    expect(calls).toBe(1);

    queue.reset({ state: state("Fresh"), version: 7, updatedAt: null });
    await queue.enqueue(state("Retry"));
    expect(calls).toBe(2);
  });
});

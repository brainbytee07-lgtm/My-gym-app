import { describe, expect, it } from "vitest";
import { exercises, starterRoutines } from "./data";
import {
  currentStreak, generateRoutine, getTodayRoutine, routineToWorkoutSets,
  volumeChangePercent, workoutCompletion, workoutVolume, workoutsInLastDays,
} from "./fitness";
import type { Profile, Workout, WorkoutSet } from "./types";

const profile: Profile = {
  name: "Test User", age: 30, height: 175, weight: 80, targetWeight: 75,
  goal: "Build muscle", experience: "Intermediate", frequency: 3,
  equipment: ["Dumbbell", "Barbell", "Cable", "Machine"], injuries: "",
};

describe("workout logging", () => {
  const sets: WorkoutSet[] = [
    { exerciseId: "bench", setNumber: 1, reps: 10, weight: 40, completed: true },
    { exerciseId: "bench", setNumber: 2, reps: 8, weight: 45, completed: true },
    { exerciseId: "bench", setNumber: 3, reps: 10, weight: 45, completed: false },
  ];

  it("uses only completed entered sets for volume and completion", () => {
    expect(workoutVolume(sets)).toBe(760);
    expect(workoutCompletion(sets)).toBe(67);
  });

  it("creates editable set records from a routine", () => {
    const result = routineToWorkoutSets(starterRoutines[0]);
    expect(result).toHaveLength(13);
    expect(result[0]).toMatchObject({ setNumber: 1, completed: false, reps: 8, weight: 45 });
  });
});

describe("routine generation", () => {
  it("builds a balanced routine using allowed equipment", () => {
    const routine = generateRoutine(profile, exercises, new Date("2026-06-10T12:00:00").getTime());
    const selected = routine.exercises.map(item => exercises.find(exercise => exercise.id === item.exerciseId)!);
    expect(selected).toHaveLength(5);
    expect(new Set(selected.map(exercise => exercise.muscle)).size).toBe(5);
    expect(selected.every(exercise => profile.equipment.includes(exercise.equipment) || exercise.equipment === "Bodyweight")).toBe(true);
  });

  it("avoids advanced exercises when injuries are recorded", () => {
    const routine = generateRoutine({ ...profile, injuries: "Sensitive shoulder", experience: "Advanced" }, exercises, 1);
    expect(routine.exercises.every(item => exercises.find(exercise => exercise.id === item.exerciseId)?.difficulty !== "Advanced")).toBe(true);
  });
});

describe("dated metrics", () => {
  const workouts: Workout[] = [
    { id: "1", routineId: "a", date: "2026-06-10", duration: 30, volume: 200, completed: 100, personalBests: 0 },
    { id: "2", routineId: "a", date: "2026-06-09", duration: 30, volume: 200, completed: 100, personalBests: 0 },
    { id: "3", routineId: "a", date: "2026-06-08", duration: 30, volume: 100, completed: 100, personalBests: 0 },
    { id: "4", routineId: "a", date: "2026-05-10", duration: 30, volume: 250, completed: 100, personalBests: 0 },
  ];

  it("selects a routine scheduled for the current weekday", () => {
    expect(getTodayRoutine(starterRoutines, new Date("2026-06-10T12:00:00")).day).toBe("Wednesday");
  });

  it("filters recent workouts and calculates streaks from dates", () => {
    const now = new Date("2026-06-10T12:00:00");
    expect(workoutsInLastDays(workouts, 7, now)).toHaveLength(3);
    expect(currentStreak(workouts, now)).toBe(3);
  });

  it("compares recent 30-day volume against the prior period", () => {
    expect(volumeChangePercent(workouts, new Date("2026-06-10T12:00:00"))).toBe(100);
  });
});

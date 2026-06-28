import type { Exercise, Profile, ProgressionDecision, Routine, RoutineExercise, Workout, WorkoutSet } from "./types";

export const localDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const workoutVolume = (sets: WorkoutSet[]) =>
  sets.filter(set => set.completed).reduce((sum, set) => sum + set.weight * set.reps, 0);

export const workoutCompletion = (sets: WorkoutSet[]) =>
  sets.length ? Math.round((sets.filter(set => set.completed).length / sets.length) * 100) : 0;

export const routineToWorkoutSets = (routine: Routine): WorkoutSet[] =>
  routine.exercises.flatMap(item =>
    Array.from({ length: item.sets }, (_, index) => ({
      exerciseId: item.exerciseId,
      setNumber: index + 1,
      reps: item.reps,
      weight: item.weight,
      completed: false,
    })),
  );

export const getTodayRoutine = (routines: Routine[], date = new Date()) => {
  const day = date.toLocaleDateString("en-US", { weekday: "long" });
  return routines.find(routine => routine.day === day) ?? routines[0];
};

export const workoutsInLastDays = (workouts: Workout[], days: number, date = new Date()) => {
  const end = new Date(`${localDate(date)}T23:59:59`);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return workouts.filter(workout => {
    const value = new Date(`${workout.date}T12:00:00`);
    return value >= start && value <= end;
  });
};

export const currentStreak = (workouts: Workout[], date = new Date()) => {
  const dates = new Set(workouts.map(workout => workout.date));
  const cursor = new Date(`${localDate(date)}T12:00:00`);
  if (!dates.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(localDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const volumeChangePercent = (workouts: Workout[], date = new Date()) => {
  const recent = workoutsInLastDays(workouts, 30, date).reduce((sum, workout) => sum + workout.volume, 0);
  const priorDate = new Date(date);
  priorDate.setDate(priorDate.getDate() - 30);
  const prior = workoutsInLastDays(workouts, 30, priorDate).reduce((sum, workout) => sum + workout.volume, 0);
  if (!prior) return recent ? 100 : 0;
  return Math.round(((recent - prior) / prior) * 100);
};

export const countPersonalBests = (workouts: Workout[]) =>
  workouts.reduce((sum, workout) => sum + workout.personalBests, 0);

const loadStepFor = (exercise?: Exercise) => {
  if (!exercise) return 2.5;
  if (exercise.equipment === "Dumbbell" || exercise.equipment === "Kettlebell") return 1;
  if (exercise.equipment === "Bodyweight" || exercise.equipment === "Resistance Band") return 0;
  return 2.5;
};

const setsForExercise = (sets: WorkoutSet[], exerciseId: string) =>
  sets.filter(set => set.exerciseId === exerciseId);

const completedTargetSets = (actual: WorkoutSet[], plan: RoutineExercise) =>
  actual.filter(set => set.completed && set.reps >= plan.reps && set.weight >= plan.weight).length;

const hadRecentMiss = (workouts: Workout[], exerciseId: string, plan: RoutineExercise) =>
  workouts.slice(0, 2).some(workout => {
    const actual = setsForExercise(workout.sets ?? [], exerciseId);
    return actual.length > 0 && completedTargetSets(actual, plan) < Math.ceil(plan.sets * 0.75);
  });

export const createProgressionDecisions = (
  workout: Workout,
  routine: Routine,
  workouts: Workout[],
  exerciseCatalog: Exercise[],
): ProgressionDecision[] => {
  const createdAt = `${workout.date}T12:00:00.000Z`;
  return routine.exercises.map(plan => {
    const exercise = exerciseCatalog.find(item => item.id === plan.exerciseId);
    const actual = setsForExercise(workout.sets ?? [], plan.exerciseId);
    const targetSets = completedTargetSets(actual, plan);
    const step = loadStepFor(exercise);
    const missed = actual.length === 0 || targetSets < Math.ceil(plan.sets * 0.75);
    const repeatedMiss = missed && hadRecentMiss(workouts.filter(item => item.routineId === routine.id), plan.exerciseId, plan);
    const hitAllTargets = targetSets >= plan.sets;
    const action: ProgressionDecision["action"] = hitAllTargets && step > 0
      ? "increase_load"
      : repeatedMiss && plan.weight > step
        ? "reduce_load"
        : missed
          ? "review"
          : "hold";
    const nextWeight = action === "increase_load"
      ? plan.weight + step
      : action === "reduce_load"
        ? Math.max(0, plan.weight - step)
        : plan.weight;
    const reason = action === "increase_load"
      ? `Completed all ${plan.sets} planned sets at target reps.`
      : action === "reduce_load"
        ? "Missed target reps in two recent sessions."
        : action === "review"
          ? "Workout result was below the planned target."
          : "Performance matched the plan. Keep the same target next time.";
    return {
      id: `${workout.id}-${plan.exerciseId}`,
      workoutId: workout.id,
      routineId: routine.id,
      exerciseId: plan.exerciseId,
      exerciseName: exercise?.name ?? plan.exerciseId,
      action,
      currentWeight: plan.weight,
      nextWeight,
      reason,
      status: "pending",
      createdAt,
    };
  });
};

export const applyProgressionDecisions = (routine: Routine, decisions: ProgressionDecision[]): Routine => {
  const accepted = new Map(decisions.filter(decision => decision.status === "accepted").map(decision => [decision.exerciseId, decision]));
  if (!accepted.size) return routine;
  return {
    ...routine,
    version: (routine.version ?? 1) + 1,
    source: "adapted",
    exercises: routine.exercises.map(item => {
      const decision = accepted.get(item.exerciseId);
      return decision ? { ...item, weight: decision.nextWeight } : item;
    }),
  };
};

const selectBalanced = (pool: Exercise[], count: number) => {
  const selected: Exercise[] = [];
  const groups = new Map<string, Exercise[]>();
  pool.forEach(exercise => groups.set(exercise.muscle, [...(groups.get(exercise.muscle) ?? []), exercise]));
  while (selected.length < count && groups.size) {
    for (const [muscle, choices] of groups) {
      const next = choices.shift();
      if (next) selected.push(next);
      if (!choices.length) groups.delete(muscle);
      if (selected.length === count) break;
    }
  }
  return selected;
};

export const generateRoutine = (profile: Profile, exercises: Exercise[], now = Date.now()): Routine => {
  const allowed = new Set([...profile.equipment, "Bodyweight"]);
  const equipmentPool = exercises.filter(exercise => allowed.has(exercise.equipment));
  const safePool = profile.injuries.trim()
    ? equipmentPool.filter(exercise => exercise.difficulty !== "Advanced")
    : equipmentPool;
  const levelPool = profile.experience === "Beginner"
    ? safePool.filter(exercise => exercise.difficulty === "Beginner")
    : safePool.filter(exercise => exercise.difficulty !== "Advanced" || profile.experience === "Advanced");
  const selected = selectBalanced(levelPool.length >= 5 ? levelPool : safePool, 5);
  const dayOffset = Math.max(1, Math.min(6, profile.frequency));
  const scheduled = new Date(now);
  scheduled.setDate(scheduled.getDate() + dayOffset);
  const sets = profile.experience === "Beginner" ? 3 : 4;
  const reps = profile.goal === "Get stronger" ? 6 : profile.goal === "Build muscle" ? 10 : 12;
  const items: RoutineExercise[] = selected.map(exercise => ({
    exerciseId: exercise.id, sets, reps, rest: profile.goal === "Get stronger" ? 120 : 75, weight: 0,
  }));
  return {
    id: `generated-${now}`,
    name: `${profile.goal} Flow`,
    day: scheduled.toLocaleDateString("en-US", { weekday: "long" }),
    focus: [...new Set(selected.map(exercise => exercise.muscle))].join(" + "),
    duration: Math.max(30, items.length * 10),
    color: "#ded5ff",
    exercises: items,
  };
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  secondary: string[];
  equipment: string;
  type: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  color: string;
  icon: string;
  image: string;
  caloriesPerMinute: number;
  instructions: string[];
  safety: string;
};

export type RoutineExercise = {
  exerciseId: string;
  sets: number;
  reps: number;
  rest: number;
  weight: number;
};

export type Routine = {
  id: string;
  name: string;
  day: string;
  focus: string;
  duration: number;
  color: string;
  version?: number;
  source?: "manual" | "generated" | "adapted";
  exercises: RoutineExercise[];
};

export type ProgressionDecision = {
  id: string;
  workoutId: string;
  routineId: string;
  exerciseId: string;
  exerciseName: string;
  action: "increase_load" | "hold" | "reduce_load" | "review";
  currentWeight: number;
  nextWeight: number;
  reason: string;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
};

export type Workout = {
  id: string;
  routineId: string;
  routineVersion?: number;
  date: string;
  duration: number;
  volume: number;
  completed: number;
  personalBests: number;
  calories?: number;
  sets?: WorkoutSet[];
  progressionDecisions?: ProgressionDecision[];
};

export type WorkoutSet = {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
};

export type CalorieEntry = {
  id: string;
  date: string;
  name: string;
  calories: number;
  type: "food" | "exercise";
};

export type Profile = {
  name: string;
  age: number;
  height: number;
  weight: number;
  targetWeight: number;
  goal: string;
  experience: string;
  frequency: number;
  equipment: string[];
  injuries: string;
};

export type FitFlowState = {
  profile: Profile;
  routines: Routine[];
  workouts: Workout[];
  calories: CalorieEntry[];
  progressionDecisions: ProgressionDecision[];
  onboarded: boolean;
};

export type CloudState = {
  state: FitFlowState;
  version: number;
  updatedAt: string | null;
};

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export type AuthState =
  | { status: "loading"; userId: null }
  | { status: "anonymous"; userId: null }
  | { status: "authenticated"; userId: string };

export type HydrationStatus = "idle" | "loading" | "ready" | "error";

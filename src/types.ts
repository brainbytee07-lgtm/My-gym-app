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
  exercises: RoutineExercise[];
};

export type Workout = {
  id: string;
  routineId: string;
  date: string;
  duration: number;
  volume: number;
  completed: number;
  personalBests: number;
  calories?: number;
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

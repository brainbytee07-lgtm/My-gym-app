import type { CalorieEntry, Exercise, Routine, Workout } from "./types";

const colors = ["#ded5ff", "#c8ef9e", "#f2f0f7"];
const img = (name: string) => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${name}/0.jpg`;
type Seed = [string, string, string, string, string, string?];

const seeds: Record<string, Seed[]> = {
  Chest: [
    ["Barbell Bench Press","Barbell","Strength","Intermediate","Barbell_Bench_Press_-_Medium_Grip"],
    ["Incline Dumbbell Press","Dumbbell","Strength","Intermediate","Incline_Dumbbell_Press"],
    ["Push-up","Bodyweight","Functional","Beginner","Pushups"],
    ["Machine Chest Press","Machine","Strength","Beginner","Leverage_Chest_Press"],
    ["Standing Cable Fly","Cable","Isolation","Intermediate","Cable_Crossover"],
    ["Pec Deck Fly","Machine","Isolation","Beginner","Butterfly"],
    ["Smith Machine Bench Press","Smith Machine","Strength","Beginner","Smith_Machine_Bench_Press"],
    ["Decline Barbell Press","Barbell","Strength","Intermediate","Decline_Barbell_Bench_Press"],
    ["Resistance Band Chest Press","Resistance Band","Strength","Beginner","Bench_Press_-_With_Bands"],
    ["Resistance Band Fly","Resistance Band","Isolation","Beginner","Cross_Over_-_With_Bands"],
  ],
  Back: [
    ["Lat Pulldown","Machine","Strength","Beginner","Wide-Grip_Lat_Pulldown"],
    ["Seated Cable Row","Cable","Strength","Beginner","Seated_Cable_Rows"],
    ["Pull-up","Bodyweight","Strength","Advanced","Pullups"],
    ["Barbell Bent-over Row","Barbell","Strength","Intermediate","Bent_Over_Barbell_Row"],
    ["One-arm Dumbbell Row","Dumbbell","Strength","Beginner","One-Arm_Dumbbell_Row"],
    ["Assisted Pull-up Machine","Machine","Strength","Beginner","Band_Assisted_Pull-Up"],
    ["T-bar Row","Machine","Strength","Intermediate","T-Bar_Row_with_Handle"],
    ["Straight-arm Pulldown","Cable","Isolation","Intermediate","Straight-Arm_Pulldown"],
    ["Resistance Band Row","Resistance Band","Strength","Beginner","Upright_Row_-_With_Bands"],
    ["Resistance Band Pulldown","Resistance Band","Strength","Beginner","Band_Assisted_Pull-Up"],
  ],
  Legs: [
    ["Goblet Squat","Dumbbell","Strength","Beginner","Goblet_Squat"],
    ["Barbell Back Squat","Barbell","Strength","Intermediate","Barbell_Full_Squat"],
    ["45 Degree Leg Press","Machine","Strength","Beginner","Leg_Press"],
    ["Leg Extension","Machine","Isolation","Beginner","Leg_Extensions"],
    ["Seated Leg Curl","Machine","Isolation","Beginner","Seated_Leg_Curl"],
    ["Hack Squat Machine","Machine","Strength","Intermediate","Hack_Squat"],
    ["Walking Lunge","Bodyweight","Functional","Beginner","Bodyweight_Walking_Lunge"],
    ["Romanian Deadlift","Barbell","Strength","Intermediate","Romanian_Deadlift"],
    ["Resistance Band Squat","Resistance Band","Strength","Beginner","Squat_with_Bands"],
    ["Resistance Band Leg Curl","Resistance Band","Isolation","Beginner","Band_Good_Morning"],
  ],
  Shoulders: [
    ["Dumbbell Shoulder Press","Dumbbell","Strength","Beginner","Dumbbell_Shoulder_Press"],
    ["Machine Shoulder Press","Machine","Strength","Beginner","Machine_Shoulder_Military_Press"],
    ["Barbell Overhead Press","Barbell","Strength","Intermediate","Standing_Military_Press"],
    ["Dumbbell Lateral Raise","Dumbbell","Isolation","Beginner","Side_Lateral_Raise"],
    ["Cable Lateral Raise","Cable","Isolation","Intermediate","Cable_Seated_Lateral_Raise"],
    ["Reverse Pec Deck","Machine","Isolation","Beginner","Reverse_Flyes"],
    ["Arnold Press","Dumbbell","Strength","Intermediate","Arnold_Dumbbell_Press"],
    ["Face Pull","Cable","Functional","Beginner","Face_Pull"],
    ["Resistance Band Shoulder Press","Resistance Band","Strength","Beginner","Shoulder_Press_-_With_Bands"],
    ["Resistance Band Pull-apart","Resistance Band","Functional","Beginner","Band_Pull_Apart"],
  ],
  Arms: [
    ["Dumbbell Curl","Dumbbell","Strength","Beginner","Dumbbell_Bicep_Curl"],
    ["Tricep Pushdown","Cable","Strength","Beginner","Triceps_Pushdown"],
    ["Preacher Curl Machine","Machine","Isolation","Beginner","Preacher_Curl"],
    ["Cable Curl","Cable","Isolation","Beginner","Cable_Hammer_Curls_-_Rope_Attachment"],
    ["Barbell Curl","Barbell","Strength","Intermediate","Barbell_Curl"],
    ["Skull Crusher","Barbell","Strength","Intermediate","Lying_Triceps_Press"],
    ["Dumbbell Hammer Curl","Dumbbell","Strength","Beginner","Hammer_Curls"],
    ["Machine Tricep Extension","Machine","Isolation","Beginner","Machine_Triceps_Extension"],
    ["Resistance Band Curl","Resistance Band","Strength","Beginner","Close-Grip_EZ-Bar_Curl_with_Band"],
    ["Resistance Band Tricep Extension","Resistance Band","Strength","Beginner","Speed_Band_Overhead_Triceps"],
  ],
  Core: [
    ["Forearm Plank","Bodyweight","Stability","Beginner","Plank"],
    ["Crunch","Bodyweight","Strength","Beginner","Crunches"],
    ["Hanging Leg Raise","Bodyweight","Strength","Advanced","Hanging_Leg_Raise"],
    ["Cable Crunch","Cable","Strength","Intermediate","Cable_Crunch"],
    ["Ab Crunch Machine","Machine","Strength","Beginner","Ab_Crunch_Machine"],
    ["Russian Twist","Bodyweight","Functional","Intermediate","Russian_Twist"],
    ["Dead Bug","Bodyweight","Stability","Beginner","Dead_Bug"],
    ["Ab Wheel Rollout","Ab Wheel","Strength","Advanced","Ab_Roller"],
    ["Resistance Band Woodchop","Resistance Band","Functional","Beginner","Standing_Cable_Wood_Chop"],
    ["Resistance Band Pallof Press","Resistance Band","Stability","Beginner","Pallof_Press"],
  ],
  Cardio: [
    ["Treadmill Run","Treadmill","Cardio","Beginner","Jogging_Treadmill"],
    ["Incline Treadmill Walk","Treadmill","Cardio","Beginner","Walking_Treadmill"],
    ["Stationary Bike","Bike","Cardio","Beginner","Bicycling_Stationary"],
    ["Elliptical Trainer","Elliptical","Cardio","Beginner","Elliptical_Trainer"],
    ["Rowing Machine","Rowing Machine","Cardio","Intermediate","Rowing_Stationary"],
    ["Stair Climber","Stair Climber","Cardio","Intermediate","Stairmaster"],
    ["Jump Rope","Jump Rope","Cardio","Intermediate","Rope_Jumping"],
    ["Battle Ropes","Battle Ropes","Cardio","Intermediate","Battling_Ropes"],
    ["Sled Push","Sled","Cardio","Advanced","Prowler_Sprint"],
    ["Air Bike","Bike","Cardio","Intermediate","Bicycling_Stationary"],
  ],
};

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const calorieRate: Record<string, number> = { Cardio: 10, Functional: 7, Strength: 5, Isolation: 4, Stability: 3 };

export const exercises: Exercise[] = Object.entries(seeds).flatMap(([muscle, items]) =>
  items.map(([name, equipment, type, difficulty, image], index) => ({
    id: slug(name), name, muscle, secondary: [], equipment, type,
    difficulty: difficulty as Exercise["difficulty"], color: colors[index % colors.length],
    icon: slug(equipment), image: img(image), caloriesPerMinute: calorieRate[type] || 5,
    instructions: [
      `Set up for ${name.toLowerCase()} with a stable starting position.`,
      "Brace your core and begin the movement under control.",
      "Complete the full comfortable range without using momentum.",
      "Return slowly to the starting position and repeat.",
    ],
    safety: `Use a manageable load and stop ${name.toLowerCase()} if you feel sharp pain.`,
  }))
);

const findId = (name: string) => exercises.find(x => x.name === name)!.id;
export const starterRoutines: Routine[] = [
  { id: "push-power", name: "Push Power", day: "Monday", focus: "Chest + Shoulders", duration: 48, color: colors[0], exercises: ["Barbell Bench Press","Incline Dumbbell Press","Dumbbell Shoulder Press","Tricep Pushdown"].map((name,i) => ({ exerciseId: findId(name), sets: i ? 3 : 4, reps: i ? 10 : 8, rest: 75, weight: i ? 15 : 45 })) },
  { id: "lower-foundation", name: "Lower Foundation", day: "Wednesday", focus: "Legs", duration: 55, color: colors[1], exercises: ["Barbell Back Squat","Romanian Deadlift","45 Degree Leg Press","Walking Lunge"].map(name => ({ exerciseId: findId(name), sets: 4, reps: 10, rest: 90, weight: 40 })) },
  { id: "pull-builder", name: "Pull Builder", day: "Friday", focus: "Back + Arms", duration: 50, color: colors[2], exercises: ["Lat Pulldown","Seated Cable Row","Pull-up","Dumbbell Curl"].map(name => ({ exerciseId: findId(name), sets: 3, reps: 10, rest: 75, weight: 25 })) },
];

export const starterWorkouts: Workout[] = [
  { id: "w1", routineId: "push-power", date: "2026-06-05", duration: 46, volume: 4210, completed: 100, personalBests: 2, calories: 280 },
  { id: "w2", routineId: "lower-foundation", date: "2026-06-03", duration: 51, volume: 5860, completed: 92, personalBests: 1, calories: 340 },
  { id: "w3", routineId: "pull-builder", date: "2026-06-01", duration: 48, volume: 3740, completed: 100, personalBests: 0, calories: 295 },
];

export const starterCalories: CalorieEntry[] = [
  { id: "c1", date: "2026-06-07", name: "Breakfast", calories: 420, type: "food" },
  { id: "c2", date: "2026-06-07", name: "Lunch", calories: 610, type: "food" },
  { id: "c3", date: "2026-06-07", name: "Push Power", calories: 280, type: "exercise" },
];

# FitFlow App Context

## Product

FitFlow is a mobile-first gym routine planner, workout logger, and progress tracker. Its core promise is simple: create a practical routine from a user's goal and available equipment, log the work actually performed, and show progress using trustworthy data.

## Current Product Direction

- Primary user: an individual gym-goer who wants structure without spreadsheet-level complexity.
- Core loop: onboard -> choose or generate routine -> log completed sets -> review progress.
- Differentiator to strengthen: routines adapted to equipment, experience, limitations, and actual performance.
- Design direction: compact mobile app, light surfaces, purple accent, simple cards, minimal navigation.
- Product rule: never present demo or hard-coded values as real user progress.

## Implemented Features

- Three-step fitness onboarding.
- Exercise explorer with search, muscle, and equipment filters.
- Exercise instructions, safety notes, and images.
- Editable routines with sets, reps, weight, and rest.
- Balanced routine generation based on profile equipment, experience, goal, and injury flag.
- Workout logging with editable reps and weight, added sets, set completion, volume, completion percentage, estimated calories, and personal-best detection.
- Dated weekly summaries, current streak, 30-day volume comparison, progress chart, and today's calories.
- Local-storage demo mode.
- Optional Supabase Google authentication and versioned per-user JSON state sync.

## Architecture

- Frontend: React 19, TypeScript, Vite, React Router.
- Main UI: `src/App.tsx`.
- Shared fitness calculations: `src/fitness.ts`.
- Seed exercise/routine/demo data: `src/data.ts`.
- Domain types: `src/types.ts`.
- Supabase client: `src/supabase.ts`.
- Database and RLS setup: `supabase/schema.sql`.
- Styling: `src/styles.css`.
- Tests: `src/fitness.test.ts` using Vitest.

## Data Rules

- Workout volume is the sum of `weight * reps` for completed sets only.
- Workout completion is the percentage of completed sets.
- Workout inputs are stored inside `Workout.sets`.
- A personal best is counted once per exercise when a completed set exceeds that exercise's prior best set volume.
- “Today” values must filter by the user's local calendar date.
- Weekly values use the last seven local calendar days.
- Routine scheduling prefers a routine matching the current weekday, then falls back to the first routine.
- Generated routines rotate across muscle groups and only use allowed equipment plus bodyweight.
- When injuries are recorded, generated routines exclude advanced exercises.

## Supabase Safety

- Cloud hydration, local storage, and writes are keyed to the authenticated user ID.
- Cloud writes remain disabled until that user's state has finished hydrating.
- A new account with no cloud state starts clean instead of inheriting another user's local state.
- Logout clears the active user and disables cloud writes before signing out.
- Cloud writes are serialized and use compare-and-swap version checks to expose stale-device conflicts.
- Row-level security in `supabase/schema.sql` restricts personal records to their owner.

## Known Constraints

- The fast prototype sync layer stores app state in `user_states`; normalized tables are not yet used by the UI.
- Body-weight history is not stored yet, so the app shows distance to target rather than a fabricated weight trend.
- Calorie targets remain a fixed `2200` kcal and are not personalized.
- Exercise descriptions are generic and images depend on an external GitHub dataset.
- Conflicts require a reload; field-level merging is not implemented.
- Automated tests cover shared fitness rules, not full browser interaction or Supabase integration.

## Commands

```powershell
npm.cmd run dev
npm.cmd run test
npm.cmd run build
```

## Next High-Value Work

1. Move workout and set writes to normalized Supabase tables.
2. Add body-measurement history and real weight charts.
3. Add routine progression recommendations based on prior completed sets.
4. Add browser-level tests for onboarding, workout completion, and account switching.
5. Validate exercise instructions and replace generic safety text with reviewed content.

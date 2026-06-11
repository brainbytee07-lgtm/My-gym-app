# FitFlow Project

Last updated: 2026-06-12

## Product Summary

FitFlow is a mobile-first gym routine planner, workout logger, exercise explorer, calorie tracker, and progress dashboard. It helps an individual gym-goer create a practical routine from their goal and available equipment, record completed work, and review trustworthy progress.

Core loop:

1. Sign in or enter demo mode.
2. Complete a fitness profile.
3. Choose, generate, or edit a routine.
4. Log completed sets with actual reps and weight.
5. Review progress, streaks, volume, personal bests, and calories.

## User Experience and Design System

- Mobile-first responsive web app.
- Visual direction: off-white surfaces, violet accent, and near-black primary actions.
- Rounded cards and compact bottom navigation.
- Exercise-specific demonstration images from the public Free Exercise DB dataset.
- Current accessibility upgrade focuses on readable type, 44px touch targets, keyboard focus, dialog semantics, and honest interactions.

## Functional Areas

### Authentication and Onboarding

- Google OAuth when Supabase environment variables are configured.
- Local demo mode without Supabase.
- Three-step onboarding captures identity, body metrics, goal, experience, frequency, equipment, and limitations.

### Exercise Explorer

- 70 built-in records: 10 each for chest, back, legs, shoulders, arms, core, and cardio.
- Search and filtering by target area and equipment.
- Resistance-band alternatives and cardio section.
- Exercise detail includes image, equipment, instructions, and safety guidance.

### Routines and Training

- Starter push, lower-body, and pull routines.
- Rules-based routine generation using profile goal, equipment, experience, frequency, and injury flag.
- Routine editing supports add, remove, sets, reps, target weight, rest, and exercise-image preview.
- Active workouts record actual sets, reps, weight, completion, volume, estimated calories, and personal bests.

### Progress and Calories

- Progress metrics are calculated from completed workout records.
- Tracks workout volume, completion, streaks, personal bests, and distance to target weight.
- Calorie screen tracks food entries and estimated exercise calories for the user's local date.

## Architecture and Data Flow

- Frontend: React 19, TypeScript, Vite, React Router.
- Main UI and orchestration: `src/App.tsx`.
- Shared calculations and routine generation: `src/fitness.ts`.
- Scoped local persistence and serialized cloud-write queue: `src/storage.ts`.
- Domain types: `src/types.ts`.
- Seed catalog and starter data: `src/data.ts`.
- Supabase client: `src/supabase.ts`.
- Styling: `src/styles.css`.
- Unit tests: `src/fitness.test.ts`.

The current prototype supports account-scoped local persistence and optional Supabase sync. Demo data uses `fitflow-state:demo`; authenticated data uses `fitflow-state:user:<user-id>`. Legacy unscoped records migrate once into demo storage.

## Database and Security

- Supabase schema is stored in `supabase/schema.sql`.
- Normalized tables exist for profiles, exercises, routines, routine exercises, workouts, workout sets, measurements, and progress photos.
- The UI currently uses `user_states` as the temporary cloud source of truth.
- Row-level security restricts personal records to the authenticated owner.
- State versioning and the `compare_and_swap_user_state` function prevent silent stale-device overwrites. Client writes are serialized and stop on conflict until the app is reloaded.
- Full migration of the UI to normalized tables is intentionally deferred.

## Verification and Deployment

Commands:

```powershell
npm.cmd run dev
npm.cmd run test
npm.cmd run build
git diff --check
```

- GitHub repository: `https://github.com/brainbytee07-lgtm/My-gym-app`
- Vercel can import the GitHub repository and deploy the Vite `dist` output.
- Never claim verification or deployment succeeded without running the relevant check.

## Decision Log

### 2026-06-12: Harden JSON sync before normalized migration

Keep `user_states` as the temporary cloud source of truth, but add account-scoped local persistence, authentication loading, state versioning, serialized writes, and stale-write conflict handling. A full normalized-table migration would be safer long-term but is too large for the current reliability pass.

### 2026-06-12: Fix critical and high-priority audit findings first

Prioritize account isolation, cloud data-loss prevention, honest UI interactions, accessibility basics, mobile readability, and trustworthy calculated metrics. Defer progress-photo storage, full exercise-content review, and normalized-table UI integration.

### 2026-06-12: Use a documentation rule instead of an automatic Git hook

Maintain `PROJECT.md` through `AGENTS.md` instructions after meaningful work. A Git hook cannot reliably understand product decisions or implementation context and would encourage low-quality automated logs.

## Implementation Log

### 2026-06-12: Reliability and UX upgrade in progress

- Spawned dedicated UI and database/backend audit agents.
- Preserved uncommitted fitness calculations, workout-set logging, tests, and cloud-error handling.
- Identified critical cross-account local-storage exposure and stale cloud-write risk.
- Identified misleading decorative controls, accessibility gaps, tiny text, touch-target issues, and hard-coded week status.
- Began implementing scoped/versioned state, honest routine editing, current-date week status, resilient navigation, modal accessibility, and mobile usability.
- Added `AGENTS.md` and this living project document.

### 2026-06-12: Reliability and UX upgrade completed

- Added account-scoped local state, one-time legacy migration, authenticated loading states, account-switch resets, serialized cloud writes, and visible version-conflict handling.
- Added `state_version` and an authenticated compare-and-swap function to the Supabase schema.
- Converted routine editing to draft mode with unsaved-change messaging, explicit save behavior, discard confirmation, and save-before-workout behavior.
- Replaced hard-coded training-week dates with current dates and completed-workout status.
- Removed misleading decorative controls, added a Profile-to-Calories route, and made detail back actions remain inside FitFlow.
- Added dialog semantics, Escape close, initial focus, focus trapping, focus restoration, accessible icon labels, readable text, larger touch targets, focus-visible styling, and safe-area spacing.
- Added scoped-state, migration, queue, conflict, fitness-calculation, routine-generation, and date tests.
- Verified 11 tests, the production build, and `git diff --check`.

### 2026-06-11: Working prototype and exercise catalog

- Built the React/Vite mobile-first prototype.
- Added onboarding, exercise explorer, routines, active workout logging, progress, profile, cardio, and calories.
- Expanded to 70 exercise records and validated image IDs.
- Added exercise preview, routine add/remove controls, personalized greeting, Supabase schema, Google OAuth adapter, and GitHub repository.

## Known Constraints and Next Work

- Full normalized Supabase-table integration remains deferred.
- The exercise catalog has generic instructions and calorie estimates; expert content review is still needed.
- Body-weight history and progress-photo storage are not implemented.
- Cloud sync uses a whole-state JSON record with conflict detection rather than field-level merging.
- The updated Supabase schema must be applied to the hosted project before compare-and-swap cloud writes can run.
- Browser-level and Supabase integration tests need expansion. The final in-app browser pass was blocked by a Windows sandbox startup issue.
- The production JavaScript bundle is slightly above Vite's 500 kB warning threshold; code splitting is deferred.

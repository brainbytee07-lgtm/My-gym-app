# FitFlow

Mobile-first gym routine planner, workout logger, and progress tracker.

## What works

- Guided fitness-profile onboarding
- Searchable and filterable built-in exercise catalog
- 70 built-in exercise records: 10 each for six strength areas plus cardio
- Exercise-specific demonstration images and resistance-band options
- Exercise instructions and safety notes
- Rules-based routine generation using profile equipment and experience
- Editable routines with sets, reps, weight, and rest
- Active workout logging with editable and additional sets
- Data-derived workout volume, completion, streak, and personal-best views
- Cardio discovery and calorie intake/burn tracking
- Profile editing and local demo persistence
- Supabase Google OAuth, cross-device state sync, and row-level security schema

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

The app works in demo mode without configuration. Data is stored in browser local storage.

## Verify changes

```powershell
npm.cmd run test
npm.cmd run build
```

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Enable Google under **Authentication > Providers** and add the callback URL Supabase provides to Google Cloud.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key.
5. Start the app. Google sign-in automatically uses Supabase when the environment variables are present.

The SQL schema includes ownership policies so authenticated users can only access their own personal data. In demo mode, activity stays in local storage. With Supabase configured, the app syncs the user profile, routines, and workouts across devices through `user_states`; normalized tables are included for future analytics and reporting.

## State and backend contract

`user_states` is the active source of truth for the prototype. It stores one complete
`FitFlowState` JSON record per authenticated user. The normalized profile, routine,
workout, and measurement tables are dormant contracts for a future migration; do not
write to both models as independent sources of truth.

Browser persistence must use the helpers in `src/storage.ts`:

- Demo state is stored under `fitflow-state:demo`.
- Authenticated state is stored under `fitflow-state:user:<user-id>`.
- Previous unscoped `fitflow-*` records migrate once into demo state and are removed.
- Account changes must load the new scope before rendering personal data.

Cloud writes should call the authenticated `compare_and_swap_user_state` function,
using the last loaded `state_version` as `expected_version`. The function increments
the version after a successful write and returns a conflict when another device has
already written a newer version. On conflict, stop queued writes and reload before
allowing another save.

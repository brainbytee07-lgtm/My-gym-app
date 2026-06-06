# FitFlow

Mobile-first gym routine planner, workout logger, and progress tracker.

## What works

- Guided fitness-profile onboarding
- Searchable and filterable built-in exercise catalog
- 70 verified exercise records: 10 each for six strength areas plus cardio
- Exercise-specific demonstration images and resistance-band options
- Exercise instructions and safety notes
- Rules-based routine generation using profile equipment and experience
- Editable routines with sets, reps, weight, and rest
- Active workout set logging and completion summary
- Workout volume, streak, personal-best, and body-progress views
- Cardio discovery and calorie intake/burn tracking
- Profile editing and local demo persistence
- Supabase Google OAuth, cross-device state sync, and row-level security schema

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

The app works in demo mode without configuration. Data is stored in browser local storage.

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Enable Google under **Authentication > Providers** and add the callback URL Supabase provides to Google Cloud.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key.
5. Start the app. Google sign-in automatically uses Supabase when the environment variables are present.

The SQL schema includes ownership policies so authenticated users can only access their own personal data. In demo mode, activity stays in local storage. With Supabase configured, the app syncs the user profile, routines, and workouts across devices through `user_states`; normalized tables are included for future analytics and reporting.

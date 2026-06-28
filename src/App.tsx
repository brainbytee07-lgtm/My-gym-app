import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  Activity, ArrowLeft, ArrowRight, Award, BarChart3, CalendarDays, Check, ChevronRight,
  Clock3, Dumbbell, Flame, Home, LogOut, Menu, Pencil, Play, Plus, Search, Settings,
  ShieldCheck, Sparkles, Target, TrendingUp, Trophy, UserRound, Weight, X
} from "lucide-react";
import { exercises, starterCalories, starterRoutines, starterWorkouts } from "./data";
import {
  applyProgressionDecisions, countPersonalBests, createProgressionDecisions, currentStreak, generateRoutine, getTodayRoutine, localDate,
  routineToWorkoutSets, volumeChangePercent, workoutCompletion, workoutVolume, workoutsInLastDays,
} from "./fitness";
import { createCloudStateQueue, loadScopedState, saveScopedState, userStorageScope, type StorageScope } from "./storage";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { AuthState, CalorieEntry, FitFlowState, Profile, ProgressionDecision, Routine, RoutineExercise, Workout, WorkoutSet } from "./types";

const defaultProfile: Profile = {
  name: "Alex Morgan", age: 28, height: 178, weight: 76.4, targetWeight: 72,
  goal: "Build muscle", experience: "Intermediate", frequency: 3,
  equipment: ["Dumbbell", "Barbell", "Cable", "Machine"], injuries: "",
};

const readStore = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
};
const fallbackState: FitFlowState = {
  profile: defaultProfile,
  routines: starterRoutines,
  workouts: starterWorkouts,
  calories: starterCalories,
  progressionDecisions: [],
  onboarded: false,
};
const validState = (state: FitFlowState): FitFlowState => ({
  ...state,
  progressionDecisions: state.progressionDecisions ?? [],
  routines: state.routines.length && state.routines.every(r => r.exercises.every(item => exercises.some(ex => ex.id === item.exerciseId))) ? state.routines : starterRoutines,
});

function App() {
  const initialDemo = validState(loadScopedState(localStorage, "demo", fallbackState));
  const [signedIn, setSignedIn] = useState<boolean>(() => !isSupabaseConfigured && readStore("fitflow-demo-signed-in", false));
  const [auth, setAuth] = useState<AuthState>(isSupabaseConfigured ? { status: "loading", userId: null } : { status: "anonymous", userId: null });
  const [hydrated, setHydrated] = useState(!isSupabaseConfigured);
  const [profile, setProfile] = useState<Profile>(initialDemo.profile);
  const [routines, setRoutines] = useState<Routine[]>(initialDemo.routines);
  const [workouts, setWorkouts] = useState<Workout[]>(initialDemo.workouts);
  const [calories, setCalories] = useState<CalorieEntry[]>(initialDemo.calories);
  const [progressionDecisions, setProgressionDecisions] = useState(initialDemo.progressionDecisions ?? []);
  const [onboarded, setOnboarded] = useState(initialDemo.onboarded);
  const [cloudError, setCloudError] = useState("");
  const cloudQueue = useRef<ReturnType<typeof createCloudStateQueue> | null>(null);
  const skipNextCloudWrite = useRef(false);
  const activeUser = useRef<string | null | undefined>(undefined);
  const state: FitFlowState = { profile, routines, workouts, calories, progressionDecisions, onboarded };
  const applyState = (next: FitFlowState) => {
    const checked = validState(next);
    setProfile(checked.profile); setRoutines(checked.routines); setWorkouts(checked.workouts);
    setProgressionDecisions(checked.progressionDecisions ?? []);
    setCalories(checked.calories); setOnboarded(checked.onboarded);
  };

  useEffect(() => {
    if (!supabase) return;
    const handleSession = (userId: string | null) => {
      if (activeUser.current === userId) return;
      activeUser.current = userId;
      setHydrated(false);
      setCloudError("");
      cloudQueue.current = null;
      applyState({ ...fallbackState, workouts: [], calories: [] });
      setAuth(userId ? { status: "authenticated", userId } : { status: "anonymous", userId: null });
      setSignedIn(Boolean(userId));
      if (!userId) setHydrated(true);
    };
    supabase.auth.getSession().then(({ data }) => handleSession(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => handleSession(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const client = supabase;
    if (!client || auth.status !== "authenticated") return;
    let cancelled = false;
    const hydrate = async () => {
      const scope = userStorageScope(auth.userId);
      const local = validState(loadScopedState(localStorage, scope, { ...fallbackState, workouts: [], calories: [] }));
      const { data, error } = await client.from("user_states").select("profile,routines,workouts,calories,progression_decisions,onboarded,state_version,updated_at").eq("user_id", auth.userId).maybeSingle() as { data: (FitFlowState & { progression_decisions?: typeof progressionDecisions; state_version: number; updated_at: string | null }) | null; error: unknown };
      if (cancelled) return;
      if (error) {
        console.error("FitFlow cloud hydration failed", error);
        applyState(local);
        setCloudError("Cloud sync is unavailable. Using this account's saved device data.");
        setHydrated(true);
        return;
      }
      const next = data ? validState({ ...data, progressionDecisions: data.progression_decisions ?? data.progressionDecisions ?? [] }) : local;
      applyState(next);
      saveScopedState(localStorage, scope, next);
      cloudQueue.current = createCloudStateQueue(data?.state_version ?? 0, async (nextState, expectedVersion) => {
        const { data: result, error: writeError } = await client.rpc("compare_and_swap_user_state", {
          expected_version: expectedVersion,
          next_profile: nextState.profile,
          next_routines: nextState.routines,
          next_workouts: nextState.workouts,
          next_calories: nextState.calories,
          next_progression_decisions: nextState.progressionDecisions,
          next_onboarded: nextState.onboarded,
        }) as { data: { applied: boolean; new_state_version: number }[] | null; error: unknown };
        if (writeError) throw writeError;
        const row = result?.[0];
        return row?.applied ? { status: "saved", version: row.new_state_version } : { status: "conflict", version: row?.new_state_version ?? expectedVersion };
      });
      skipNextCloudWrite.current = true;
      setHydrated(true);
    };
    hydrate();
    return () => { cancelled = true; };
  }, [auth]);
  useEffect(() => {
    if (!signedIn || !hydrated) return;
    const scope: StorageScope = auth.status === "authenticated" ? userStorageScope(auth.userId) : "demo";
    saveScopedState(localStorage, scope, state);
    if (auth.status !== "authenticated" || !cloudQueue.current) return;
    if (skipNextCloudWrite.current) { skipNextCloudWrite.current = false; return; }
    const timer = window.setTimeout(async () => {
      try {
        const result = await cloudQueue.current?.enqueue(state);
        setCloudError(result?.status === "conflict" ? "A newer cloud version exists. Reload FitFlow before making more changes." : "");
      } catch (error) {
        console.error("FitFlow cloud sync failed", error);
        setCloudError("Cloud sync is unavailable. Your latest changes remain on this device.");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [profile, routines, workouts, calories, progressionDecisions, onboarded, signedIn, hydrated, auth]);
  useEffect(() => { if (!isSupabaseConfigured) localStorage.setItem("fitflow-demo-signed-in", JSON.stringify(signedIn)); }, [signedIn]);

  const app = { profile, setProfile, routines, setRoutines, workouts, setWorkouts, calories, setCalories, progressionDecisions, setProgressionDecisions };
  if (auth.status === "loading" || (signedIn && !hydrated)) return <div className="app-loading"><Dumbbell size={32} /><strong>Loading your FitFlow...</strong></div>;
  if (!signedIn) return <Login onSignIn={() => setSignedIn(true)} />;
  if (!onboarded) return <Onboarding profile={profile} onComplete={(value) => { setProfile(value); setOnboarded(true); }} />;

  return (
    <div className="app-shell">
      {cloudError && <div className="cloud-error">{cloudError}</div>}
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Page><HomePage {...app} /></Page>} />
        <Route path="/exercises" element={<Page><ExercisesPage /></Page>} />
        <Route path="/exercises/:id" element={<ExerciseDetail routines={routines} setRoutines={setRoutines} />} />
        <Route path="/routines" element={<Page><RoutinesPage {...app} /></Page>} />
        <Route path="/routines/:id" element={<RoutineDetail {...app} />} />
        <Route path="/workout/:id" element={<ActiveWorkout {...app} />} />
        <Route path="/progress" element={<Page><ProgressPage {...app} /></Page>} />
        <Route path="/calories" element={<Page><CaloriesPage {...app} /></Page>} />
        <Route path="/profile" element={<Page><ProfilePage {...app} onLogout={async () => { setHydrated(false); if (supabase) await supabase.auth.signOut(); else { setSignedIn(false); setOnboarded(false); setHydrated(true); } }} /></Page>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}

function Login({ onSignIn }: { onSignIn: () => void }) {
  const googleSignIn = async () => {
    if (supabase) await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/home` } });
    else onSignIn();
  };
  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="brand-mark"><Dumbbell size={25} /></div>
        <div className="orb orb-one" /><div className="orb orb-two" /><div className="orb orb-three" />
        <div className="auth-figure"><Dumbbell size={92} strokeWidth={1.5} /><Sparkles className="auth-spark" /></div>
      </div>
      <section className="auth-panel">
        <span className="eyebrow">Welcome to FitFlow</span>
        <h1>Build a routine.<br /><em>Own your progress.</em></h1>
        <p>Your focused gym companion for smarter plans, stronger sessions, and visible progress.</p>
        <button className="google-button" onClick={googleSignIn}><span>G</span> Continue with Google <ArrowRight size={18} /></button>
        {!isSupabaseConfigured && <small className="demo-note">Demo mode: your changes stay on this device.</small>}
      </section>
    </main>
  );
}

function Onboarding({ profile, onComplete }: { profile: Profile; onComplete: (p: Profile) => void }) {
  const [step, setStep] = useState(1);
  const [value, setValue] = useState(profile);
  const patch = (key: keyof Profile, val: Profile[keyof Profile]) => setValue({ ...value, [key]: val });
  const toggleEquipment = (item: string) => patch("equipment", value.equipment.includes(item) ? value.equipment.filter(x => x !== item) : [...value.equipment, item]);
  return (
    <main className="onboarding">
      <header><div className="brand-inline"><Dumbbell size={20} /> FitFlow</div><span>Step {step} of 3</span></header>
      <div className="step-line"><i style={{ width: `${step * 33.33}%` }} /></div>
      <section className="onboard-card">
        {step === 1 && <>
          <span className="eyebrow">First, the basics</span><h1>Let’s make this yours.</h1><p>A few details help us shape your training.</p>
          <div className="form-grid"><Field label="Your name"><input value={value.name} onChange={e => patch("name", e.target.value)} /></Field><Field label="Age"><input type="number" value={value.age} onChange={e => patch("age", +e.target.value)} /></Field><Field label="Height (cm)"><input type="number" value={value.height} onChange={e => patch("height", +e.target.value)} /></Field><Field label="Current weight (kg)"><input type="number" value={value.weight} onChange={e => patch("weight", +e.target.value)} /></Field></div>
        </>}
        {step === 2 && <>
          <span className="eyebrow">Your direction</span><h1>What are we building?</h1><p>Choose the goal that matters most right now.</p>
          <div className="choice-grid">{["Build muscle", "Lose fat", "Get stronger", "Stay active"].map(x => <button key={x} className={value.goal === x ? "choice active" : "choice"} onClick={() => patch("goal", x)}><Target size={22} />{x}</button>)}</div>
          <div className="form-grid"><Field label="Target weight (kg)"><input type="number" value={value.targetWeight} onChange={e => patch("targetWeight", +e.target.value)} /></Field><Field label="Experience"><select value={value.experience} onChange={e => patch("experience", e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></Field><Field label="Days per week"><input type="number" min="1" max="7" value={value.frequency} onChange={e => patch("frequency", +e.target.value)} /></Field></div>
        </>}
        {step === 3 && <>
          <span className="eyebrow">Make it practical</span><h1>What can you train with?</h1><p>We’ll keep generated plans realistic and safe.</p>
          <div className="choice-grid equipment">{["Bodyweight", "Dumbbell", "Barbell", "Cable", "Machine", "Kettlebell"].map(x => <button key={x} className={value.equipment.includes(x) ? "choice active" : "choice"} onClick={() => toggleEquipment(x)}><Dumbbell size={20} />{x}</button>)}</div>
          <Field label="Injuries or movement limitations (optional)"><textarea value={value.injuries} placeholder="Example: sensitive left shoulder" onChange={e => patch("injuries", e.target.value)} /></Field>
        </>}
        <div className="onboard-actions">{step > 1 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}<button className="btn dark" onClick={() => step < 3 ? setStep(step + 1) : onComplete(value)}>{step < 3 ? "Continue" : "Build my FitFlow"} <ArrowRight size={17} /></button></div>
      </section>
    </main>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <><div className="page">{children}</div><BottomNav /></>;
}

function BottomNav() {
  const links = [{ to: "/home", icon: Home, label: "Home" }, { to: "/exercises", icon: Search, label: "Explore" }, { to: "/routines", icon: Dumbbell, label: "Train" }, { to: "/progress", icon: BarChart3, label: "Progress" }, { to: "/profile", icon: UserRound, label: "Profile" }];
  return <nav className="bottom-nav">{links.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}><Icon size={20} /><span>{label}</span></NavLink>)}</nav>;
}

function AppHeader({ profile, title }: { profile?: Profile; title?: string }) {
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.name.trim().split(" ")[0];
  return <header className="app-header">{profile ? <><div className="avatar">{profile.name.split(" ").map(x => x[0]).join("").slice(0, 2)}</div><div><small>{greeting}, {firstName}</small><strong>Ready for your next session?</strong></div></> : <h2>{title}</h2>}<button aria-label="Open profile settings" className="icon-button" onClick={() => navigate("/profile")}><Settings size={19} /></button></header>;
}

type AppProps = {
  profile: Profile; setProfile: (p: Profile) => void; routines: Routine[]; setRoutines: (r: Routine[]) => void; workouts: Workout[]; setWorkouts: (w: Workout[]) => void; calories: CalorieEntry[]; setCalories: (c: CalorieEntry[]) => void; progressionDecisions: ProgressionDecision[]; setProgressionDecisions: (d: ProgressionDecision[]) => void;
};

function HomePage({ profile, routines, workouts, calories, progressionDecisions }: AppProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const today = getTodayRoutine(routines);
  const todayKey = localDate();
  const todayCalories = calories.filter(entry => entry.date === todayKey);
  const weekWorkouts = workoutsInLastDays(workouts, 7);
  const streak = currentStreak(workouts);
  const volumeChange = volumeChangePercent(workouts);
  const latestDecision = progressionDecisions.find(decision => decision.status === "pending");
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay() + 1 + index);
    return { label: date.toLocaleDateString("en-US", { weekday: "narrow" }), key: localDate(date) };
  });
  return <>
    <AppHeader profile={profile} />
    <label className="quick-search"><Search size={18} /><span className="sr-only">Search exercises</span><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && navigate(`/exercises?q=${query}`)} placeholder="Search exercises, muscles, equipment" /></label>
    <section className="hero-card">
      <div><span className="pill">Today’s flow</span><h1>{today.name}</h1><p>{today.focus} · {today.exercises.length} exercises</p><button onClick={() => navigate(`/workout/${today.id}`)}>Start workout <Play size={15} fill="currentColor" /></button></div>
      <div className="hero-art"><span /><Dumbbell size={67} /></div>
    </section>
    <SectionHead title="This week" action="View progress" onClick={() => navigate("/progress")} />
    <div className="stat-grid">
      <StatCard icon={<Flame />} value={`${streak} days`} label="Current streak" tone="orange" />
      <StatCard icon={<Target />} value={`${weekWorkouts.length}/${profile.frequency}`} label="Workouts done" tone="blue" />
      <StatCard icon={<TrendingUp />} value={`${volumeChange > 0 ? "+" : ""}${volumeChange}%`} label="30-day volume" tone="green" />
    </div>
    {latestDecision && <button className="coach-summary" onClick={() => navigate(`/routines/${latestDecision.routineId}`)}><span><Sparkles size={19}/></span><div><small>Smarter next workout</small><strong>{latestDecision.exerciseName}: {latestDecision.action === "increase_load" ? `try ${latestDecision.nextWeight} kg` : latestDecision.action === "reduce_load" ? `drop to ${latestDecision.nextWeight} kg` : "review target"}</strong></div><ChevronRight size={17}/></button>}
    <button className="calorie-summary" onClick={() => navigate("/calories")}><span><Flame size={19}/></span><div><small>Calories today</small><strong>{todayCalories.filter(x=>x.type==="food").reduce((s,x)=>s+x.calories,0)} eaten · {todayCalories.filter(x=>x.type==="exercise").reduce((s,x)=>s+x.calories,0)} burned</strong></div><ChevronRight size={17}/></button>
    <div className="week-card"><div className="week-score"><strong>{Math.min(100, Math.round((weekWorkouts.length / profile.frequency) * 100))}%</strong><span>weekly goal</span></div><div className="days">{weekDates.map(day => { const done = workouts.some(workout => workout.date === day.key); return <div key={day.key} className={done ? "done" : ""}><i>{done && <Check size={12} />}</i><span>{day.label}</span></div> })}</div></div>
    <SectionHead title="Your plan" action="See all" onClick={() => navigate("/routines")} />
    <div className="routine-scroll">{routines.map(r => <RoutineCard key={r.id} routine={r} onClick={() => navigate(`/routines/${r.id}`)} />)}</div>
  </>;
}

function ExercisesPage() {
  const [query, setQuery] = useState(new URLSearchParams(location.search).get("q") || "");
  const [muscle, setMuscle] = useState("All");
  const [equipment, setEquipment] = useState("All");
  const navigate = useNavigate();
  const muscles = ["All", ...new Set(exercises.map(x => x.muscle))];
  const equipmentOptions = ["All", "Machine", "Dumbbell", "Barbell", "Cable", "Resistance Band", "Bodyweight"];
  const filtered = exercises.filter(x => `${x.name} ${x.muscle} ${x.equipment} ${x.type}`.toLowerCase().includes(query.toLowerCase()) && (muscle === "All" || x.muscle === muscle) && (equipment === "All" || x.equipment === equipment));
  return <>
    <AppHeader title="Explore exercises" />
    <p className="page-intro">Choose a muscle, tool, or machine. Then find your move.</p>
    <label className="quick-search large"><Search size={18} /><span className="sr-only">Search by exercise, muscle, or equipment</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by exercise, muscle or gear" />{query && <button type="button" aria-label="Clear exercise search" onClick={() => setQuery("")}><X size={16} /></button>}</label>
    <button className="cardio-banner" onClick={() => { setMuscle("Cardio"); setQuery(""); setEquipment("All"); }}><span><Activity size={22}/></span><div><strong>Cardio training</strong><small>Treadmill, bike, rowing, and more</small></div><ChevronRight size={18}/></button>
    <SectionHead title="Browse by equipment" action={equipment === "All" ? "All equipment" : equipment} />
    <div className="equipment-picker">{equipmentOptions.map(item => <button key={item} onClick={() => setEquipment(item)} className={equipment === item ? "active" : ""}><EquipmentImage equipment={item} /><span>{item === "All" ? "Everything" : item}</span><small>{item === "All" ? exercises.length : exercises.filter(ex => ex.equipment === item).length} moves</small></button>)}</div>
    <SectionHead title="Target area" action={muscle} />
    <div className="chip-row">{muscles.map(x => <button key={x} onClick={() => setMuscle(x)} className={muscle === x ? "active" : ""}>{x}</button>)}</div>
    <div className="filter-line"><span><b>{filtered.length}</b> exercises found</span>{equipment !== "All" && <button onClick={() => setEquipment("All")}>Clear equipment <X size={12}/></button>}</div>
    <div className="exercise-list">{filtered.map(ex => <button key={ex.id} className="exercise-card" onClick={() => navigate(`/exercises/${ex.id}`)}><ExerciseArt exercise={ex} /><div><span>{ex.muscle} · {ex.difficulty}</span><h3>{ex.name}</h3><p>{ex.equipment} · {ex.type}</p></div><ChevronRight size={18} /></button>)}</div>
    {!filtered.length && <Empty title="No exercises found" text="Try a different muscle, equipment filter, or search term." />}
  </>;
}

function ExerciseDetail({ routines, setRoutines }: { routines: Routine[]; setRoutines: (r: Routine[]) => void }) {
  const { id } = useParams(); const navigate = useNavigate(); const exercise = exercises.find(x => x.id === id);
  const [added, setAdded] = useState(false);
  if (!exercise) return <Navigate to="/exercises" replace />;
  const add = () => { const first = routines[0]; setRoutines([{ ...first, exercises: [...first.exercises, { exerciseId: exercise.id, sets: 3, reps: 10, rest: 60, weight: 0 }] }, ...routines.slice(1)]); setAdded(true); };
  return <div className="detail-page">
    <button aria-label="Back to exercises" className="back-button" onClick={() => navigate("/exercises")}><ArrowLeft size={19} /></button>
    <div className="detail-hero" style={{ background: exercise.color }}><ExerciseArt exercise={exercise} large /><span className="detail-badge">{exercise.difficulty}</span></div>
    <div className="detail-body"><span className="eyebrow">{exercise.muscle} · {exercise.type}</span><h1>{exercise.name}</h1><div className="detail-meta"><div><Dumbbell /><span>Equipment<strong>{exercise.equipment}</strong></span></div><div><Target /><span>Also works<strong>{exercise.secondary.join(", ") || "Isolation"}</strong></span></div></div>
    <h3>How to do it</h3><ol className="steps">{exercise.instructions.map((x,i) => <li key={x}><b>{i + 1}</b><span>{x}</span></li>)}</ol>
    <div className="safety"><ShieldCheck size={22} /><div><strong>Form check</strong><p>{exercise.safety}</p></div></div>
    <button className={added ? "btn success wide" : "btn dark wide"} onClick={add}>{added ? <><Check size={18} /> Added to {routines[0].name}</> : <><Plus size={18} /> Add to {routines[0].name}</>}</button></div>
  </div>;
}

function RoutinesPage({ profile, routines, setRoutines, workouts }: AppProps) {
  const navigate = useNavigate(); const [generator, setGenerator] = useState(false);
  const today = getTodayRoutine(routines);
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - date.getDay() + 1 + index);
    return { label: date.toLocaleDateString("en-US", { weekday: "narrow" }), number: date.getDate(), key: localDate(date) };
  });
  const generate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const generated = generateRoutine(profile, exercises);
    setRoutines([...routines, generated]); setGenerator(false); navigate(`/routines/${generated.id}`);
  };
  return <>
    <AppHeader title="Train" /><p className="page-intro">Start today’s session or shape what comes next.</p>
    <section className="train-hero" style={{ background: today.color }}>
      <div className="train-hero-copy"><span className="pill">Up next · {today.day}</span><h1>{today.name}</h1><p>{today.focus} · {today.exercises.length} exercises · {today.duration} min</p><button onClick={() => navigate(`/workout/${today.id}`)}><Play size={16} fill="currentColor"/> Start workout</button></div>
      <div className="train-hero-photo"><img src={exercises.find(x=>x.id===today.exercises[0].exerciseId)?.image} alt={today.name}/></div>
    </section>
    <div className="train-actions">
      <button onClick={() => navigate("/exercises")}><span className="train-action-icon lavender"><Search size={20}/></span><strong>Find exercises</strong><small>By muscle or equipment</small><ChevronRight size={16}/></button>
      <button onClick={() => setGenerator(true)}><span className="train-action-icon green"><Sparkles size={20}/></span><strong>Build a routine</strong><small>Matched to your goal</small><ChevronRight size={16}/></button>
    </div>
    <SectionHead title="Training this week" action={`${workoutsInLastDays(workouts, 7).length} completed`} onClick={() => navigate("/progress")} />
    <div className="train-week">{weekDates.map(day => { const done = workouts.some(workout => workout.date === day.key); return <div key={day.key} className={`${day.key === localDate() ? "active" : ""} ${done ? "complete" : ""}`}><span>{day.label}</span><b>{day.number}</b>{done && <i><Check size={9}/></i>}</div> })}</div>
    <div className="generator-strip"><span><Sparkles size={18}/></span><div><strong>Need a different plan?</strong><small>Generate one from your goal and gym access.</small></div><button onClick={() => setGenerator(true)}>Build</button></div>
    <SectionHead title="Your weekly split" action={`${routines.length} sessions`} />
    <div className="routine-list">{routines.map(r => <RoutineCard key={r.id} routine={r} onClick={() => navigate(`/routines/${r.id}`)} />)}</div>
    {generator && <Modal onClose={() => setGenerator(false)}><form onSubmit={generate}><span className="eyebrow">Routine generator</span><h2>Your next training flow</h2><p>We’ll create an editable plan using your saved profile.</p><div className="summary-box"><div><Target /><span>Goal<strong>{profile.goal}</strong></span></div><div><Activity /><span>Level<strong>{profile.experience}</strong></span></div><div><CalendarDays /><span>Frequency<strong>{profile.frequency} days/week</strong></span></div><div><Dumbbell /><span>Equipment<strong>{profile.equipment.length} types</strong></span></div></div><button className="btn dark wide" type="submit"><Sparkles size={17} /> Generate my routine</button></form></Modal>}
  </>;
}

function RoutineDetail({ routines, setRoutines }: AppProps) {
  const { id } = useParams(); const navigate = useNavigate(); const routine = routines.find(x => x.id === id);
  const [adding, setAdding] = useState(false); const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<(typeof exercises)[number] | null>(null); const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Routine>(() => routine ?? starterRoutines[0]);
  useEffect(() => { if (routine) setDraft(routine); }, [routine]);
  if (!routine) return <Navigate to="/routines" replace />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(routine);
  const update = (index: number, key: keyof RoutineExercise, value: number) => { setSaved(false); setDraft({ ...draft, exercises: draft.exercises.map((ex, i) => i === index ? { ...ex, [key]: value } : ex) }); };
  const remove = (index: number) => { setSaved(false); setDraft({ ...draft, exercises: draft.exercises.filter((_, i) => i !== index) }); };
  const add = (exerciseId: string) => {
    if (draft.exercises.some(x => x.exerciseId === exerciseId)) return;
    setSaved(false);
    setDraft({ ...draft, exercises: [...draft.exercises, { exerciseId, sets: 3, reps: 10, rest: 60, weight: 0 }] });
  };
  const saveDraft = () => {
    setRoutines(routines.map(item => item.id === routine.id ? draft : item));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };
  const leave = () => { if (!dirty || window.confirm("Discard your unsaved routine changes?")) navigate("/routines"); };
  const startWorkout = () => { if (dirty) setRoutines(routines.map(item => item.id === routine.id ? draft : item)); navigate(`/workout/${routine.id}`); };
  const choices = exercises.filter(ex => `${ex.name} ${ex.muscle} ${ex.equipment}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="detail-page routine-detail"><button aria-label="Back to routines" className="back-button" onClick={leave}><ArrowLeft size={19} /></button><div className="routine-title" style={{ background: draft.color }}><span className="pill">{draft.day}</span><h1>{draft.name}</h1><p>{draft.focus} · {draft.duration} min</p><div className="big-dumbbell"><Dumbbell size={70} /></div></div><div className="detail-body">
    <div className="routine-edit-head"><div><h2>{draft.exercises.length} exercises</h2><span>{dirty ? "Unsaved changes" : "Add, remove, or adjust your plan."}</span></div><button onClick={() => setAdding(true)}><Plus size={16}/> Add exercise</button></div>
    <div className="routine-exercises">{draft.exercises.map((item, index) => { const ex = exercises.find(x => x.id === item.exerciseId)!; return <div className="routine-exercise" key={`${item.exerciseId}-${index}`}><button className="exercise-preview-button" aria-label={`Preview ${ex.name}`} onClick={() => setPreview(ex)}><ExerciseArt exercise={ex}/><span>View</span></button><div className="routine-exercise-head"><span>{index + 1}. {ex.muscle}</span><strong>{ex.name}</strong></div><button aria-label={`Remove ${ex.name}`} title={`Remove ${ex.name}`} className="remove-exercise" onClick={() => remove(index)}><X size={14} /><span>Remove</span></button><div className="set-fields"><MiniInput label="Sets" value={item.sets} onChange={v => update(index, "sets", v)} /><MiniInput label="Reps" value={item.reps} onChange={v => update(index, "reps", v)} /><MiniInput label="Kg" value={item.weight} onChange={v => update(index, "weight", v)} /><MiniInput label="Rest" value={item.rest} onChange={v => update(index, "rest", v)} /></div></div> })}</div>
    <button disabled={!dirty} className={saved ? "btn success wide update-plan" : "btn ghost wide update-plan"} onClick={saveDraft}>{saved ? <><Check size={17}/> Plan updated</> : <><Pencil size={16}/> {dirty ? "Update plan" : "Plan is up to date"}</>}</button>
    <button className="btn dark wide" onClick={startWorkout}><Play size={17} fill="white" /> Start workout</button>
  </div>{adding && <Modal onClose={() => { setAdding(false); setQuery(""); }}><div><span className="eyebrow">Edit {draft.name}</span><h2>Add an exercise</h2><label className="quick-search"><Search size={17}/><span className="sr-only">Search exercises or equipment</span><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search exercises or equipment"/></label><div className="add-exercise-list">{choices.slice(0,20).map(ex=>{const exists=draft.exercises.some(x=>x.exerciseId===ex.id);return <button key={ex.id} disabled={exists} onClick={()=>add(ex.id)}><ExerciseArt exercise={ex}/><div><strong>{ex.name}</strong><small>{ex.muscle} · {ex.equipment}</small></div><span>{exists?<Check size={16}/>:<Plus size={16}/>}</span></button>})}</div></div></Modal>}{preview && <Modal onClose={() => setPreview(null)}><div className="exercise-pop"><img src={preview.image} alt={`${preview.name} demonstration`}/><span className="eyebrow">{preview.muscle} · {preview.equipment}</span><h2>{preview.name}</h2><p>{preview.safety}</p><button className="btn dark wide" onClick={() => setPreview(null)}>Close preview</button></div></Modal>}</div>;
}

function ActiveWorkout({ routines, setRoutines, workouts, setWorkouts, progressionDecisions, setProgressionDecisions }: AppProps) {
  const { id } = useParams(); const navigate = useNavigate(); const routine = routines.find(x => x.id === id);
  const [active, setActive] = useState(0);
  const [sets, setSets] = useState<WorkoutSet[]>(() => routine ? routineToWorkoutSets(routine) : []);
  const [finishSummary, setFinishSummary] = useState<{ workout: Workout; decisions: ProgressionDecision[] } | null>(null);
  if (!routine) return <Navigate to="/routines" replace />;
  const item = routine.exercises[active]; const ex = exercises.find(x => x.id === item.exerciseId)!;
  const activeSets = sets.filter(set => set.exerciseId === item.exerciseId);
  const completedSets = sets.filter(set => set.completed);
  const updateSet = (setNumber: number, patch: Partial<WorkoutSet>) =>
    setSets(sets.map(set => set.exerciseId === item.exerciseId && set.setNumber === setNumber ? { ...set, ...patch } : set));
  const addSet = () => setSets([...sets, {
    exerciseId: item.exerciseId,
    setNumber: activeSets.length + 1,
    reps: activeSets[activeSets.length - 1]?.reps ?? item.reps,
    weight: activeSets[activeSets.length - 1]?.weight ?? item.weight,
    completed: false,
  }]);
  const complete = () => {
    if (!completedSets.length) return;
    const previousBest = new Map<string, number>();
    workouts.flatMap(workout => workout.sets ?? []).filter(set => set.completed).forEach(set => {
      previousBest.set(set.exerciseId, Math.max(previousBest.get(set.exerciseId) ?? 0, set.weight * set.reps));
    });
    const personalBests = new Set(completedSets.filter(set => set.weight * set.reps > (previousBest.get(set.exerciseId) ?? 0)).map(set => set.exerciseId)).size;
    const calories = Math.round(routine.exercises.reduce((sum, exercise) => {
      const detail = exercises.find(value => value.id === exercise.exerciseId);
      return sum + (detail?.caloriesPerMinute ?? 5) * (routine.duration / routine.exercises.length);
    }, 0));
    const workout: Workout = {
      id: `w-${Date.now()}`, routineId: routine.id, routineVersion: routine.version ?? 1, date: localDate(), duration: routine.duration,
      volume: workoutVolume(sets), completed: workoutCompletion(sets), personalBests, calories, sets,
    };
    const decisions = createProgressionDecisions(workout, routine, workouts, exercises);
    setWorkouts([{ ...workout, progressionDecisions: decisions }, ...workouts]);
    setProgressionDecisions([...decisions, ...progressionDecisions]);
    setFinishSummary({ workout, decisions });
  };
  if (finishSummary) {
    const actionable = finishSummary.decisions.filter(decision => decision.action !== "hold");
    const acceptProgression = () => {
      const accepted = finishSummary.decisions.map(decision => ({ ...decision, status: "accepted" as const }));
      setRoutines(routines.map(item => item.id === routine.id ? applyProgressionDecisions(item, accepted) : item));
      setProgressionDecisions(progressionDecisions.map(decision => accepted.find(item => item.id === decision.id) ?? decision));
      navigate(`/routines/${routine.id}`);
    };
    return <div className="finish-page"><div className="finish-icon"><Trophy size={52} /></div><span className="eyebrow">Workout complete</span><h1>Next workout updated.</h1><p>You completed {completedSets.length} of {sets.length} sets in {routine.name}. FitFlow compared the plan against what you actually did.</p><div className="finish-stats"><StatCard icon={<Clock3 />} value={`${routine.duration} min`} label="Duration" tone="orange" /><StatCard icon={<Weight />} value={`${(workoutVolume(sets)/1000).toFixed(1)}t`} label="Volume" tone="blue" /><StatCard icon={<Award />} value={`${workoutCompletion(sets)}%`} label="Completed" tone="green" /></div><div className="coach-card"><span className="eyebrow">Adaptive coach</span><h2>{actionable.length ? "Suggested changes" : "Keep this plan"}</h2>{finishSummary.decisions.slice(0, 4).map(decision => <div key={decision.id} className="coach-row"><strong>{decision.exerciseName}</strong><span>{decision.action === "increase_load" ? `Next time: ${decision.nextWeight} kg` : decision.action === "reduce_load" ? `Reduce to ${decision.nextWeight} kg` : decision.action === "review" ? "Review target" : "Hold target"}</span><small>{decision.reason}</small></div>)}</div><div className="finish-actions"><button className="btn ghost" onClick={() => navigate("/progress")}>View progress</button><button className="btn dark" onClick={acceptProgression}>{actionable.length ? "Accept updates" : "Back to plan"} <ArrowRight size={17} /></button></div></div>;
  }
  return <div className="workout-page"><header><button aria-label="Close workout" onClick={() => navigate(`/routines/${routine.id}`)}><X size={20} /></button><div><span>{routine.name}</span><strong>{completedSets.length} of {sets.length} sets complete</strong></div><button className="text-button" disabled={!completedSets.length} onClick={complete}>Finish</button></header><div className="workout-progress"><i style={{ width: `${workoutCompletion(sets)}%` }} /></div><main><ExerciseArt exercise={ex} large /><span className="eyebrow">{ex.muscle} · {ex.equipment}</span><h1>{ex.name}</h1><p className="form-tip">{ex.safety}</p><div className="set-table"><div className="set-row heading"><span>Set</span><span>Previous</span><span>Kg</span><span>Reps</span><span /></div>{activeSets.map(set => <div className={set.completed ? "set-row complete" : "set-row"} key={set.setNumber}><b>{set.setNumber}</b><span>{item.weight} × {item.reps}</span><input aria-label={`Set ${set.setNumber} weight in kilograms`} value={set.weight} min="0" type="number" onChange={event => updateSet(set.setNumber, { weight: Math.max(0, +event.target.value) })} /><input aria-label={`Set ${set.setNumber} repetitions`} value={set.reps} min="0" type="number" onChange={event => updateSet(set.setNumber, { reps: Math.max(0, +event.target.value) })} /><button aria-label={`Mark set ${set.setNumber} complete`} onClick={() => updateSet(set.setNumber, { completed: !set.completed })}><Check size={17} /></button></div>)}</div><button className="add-set" onClick={addSet}><Plus size={16} /> Add set</button></main><footer><button className="btn ghost" disabled={active === 0} onClick={() => setActive(active - 1)}><ArrowLeft size={17} /> Previous</button>{active < routine.exercises.length - 1 ? <button className="btn dark" onClick={() => setActive(active + 1)}>Next exercise <ArrowRight size={17} /></button> : <button className="btn dark" disabled={!completedSets.length} onClick={complete}>Finish workout <Check size={17} /></button>}</footer></div>;
}

function ProgressPage({ profile, workouts, routines }: AppProps) {
  const sessions = [...workouts].slice(0, 7).reverse();
  const max = Math.max(1, ...sessions.map(workout => workout.volume));
  const change = volumeChangePercent(workouts);
  const goalDistance = Math.abs(profile.weight - profile.targetWeight).toFixed(1);
  return <><AppHeader title="Your progress" /><p className="page-intro">Every number below comes from completed workouts.</p><div className="progress-hero"><div><span className="eyebrow">Training volume</span><h1>{(workouts.reduce((s,x) => s+x.volume,0)/1000).toFixed(1)}t</h1><p>{change > 0 ? "+" : ""}{change}% versus prior 30 days</p></div><TrendingUp size={42} /></div><div className="chart-card"><SectionHead title="Last 7 sessions" action="Volume (kg)" /><div className="bar-chart">{sessions.map((workout,i) => <div key={workout.id}><span style={{ height: `${(workout.volume/max)*100}%` }} className={i === sessions.length - 1 ? "current" : ""} /><small>{new Date(`${workout.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" })}</small></div>)}</div>{!sessions.length && <Empty title="No workouts yet" text="Complete a workout to start your progress chart." />}</div><div className="stat-grid"><StatCard icon={<Flame />} value={`${currentStreak(workouts)} days`} label="Current streak" tone="orange" /><StatCard icon={<Trophy />} value={`${countPersonalBests(workouts)}`} label="Personal bests" tone="green" /><StatCard icon={<Activity />} value={`${workouts.length}`} label="Workouts" tone="blue" /></div><SectionHead title="Body goal" action="Current profile" /><div className="body-progress"><div><span>Current weight</span><strong>{profile.weight}<small> kg</small></strong><em>{goalDistance} kg from target</em></div><div className="target-row"><span>Update weight in Profile</span><span>Goal {profile.targetWeight} kg</span></div></div><SectionHead title="Recent workouts" action={`${workouts.length} logged`} /><div className="history-list">{workouts.map(w => { const r=routines.find(x=>x.id===w.routineId) || {name:"Custom Flow",focus:"Full body"}; return <div key={w.id}><span className="history-icon"><Dumbbell size={19} /></span><div><strong>{r.name}</strong><small>{w.date} · {w.duration} min · {w.completed}%</small></div><div><b>{(w.volume/1000).toFixed(1)}t</b><small>{w.personalBests ? `${w.personalBests} PB` : "Logged"}</small></div></div>})}</div></>;
}

function CaloriesPage({ calories, setCalories, workouts }: AppProps) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState("");
  const today = localDate();
  const todayEntries = calories.filter(entry => entry.date === today);
  const food = todayEntries.filter(x=>x.type==="food").reduce((s,x)=>s+x.calories,0);
  const burned = todayEntries.filter(x=>x.type==="exercise").reduce((s,x)=>s+x.calories,0) + workouts.filter(workout => workout.date === today).reduce((s,x)=>s+(x.calories||0),0);
  const target = 2200; const net = food - burned;
  const addFood = (e: FormEvent) => { e.preventDefault(); if(!name || !amount) return; setCalories([{id:`c-${Date.now()}`,date:today,name,calories:+amount,type:"food"},...calories]); setName(""); setAmount(""); };
  return <><AppHeader title="Calories"/><p className="page-intro">A simple energy view, connected to your training.</p>
    <div className="calorie-hero"><div><span>Net calories</span><h1>{net}</h1><small>{target-net} kcal remaining</small></div><div className="calorie-ring" style={{"--fill":`${Math.min(100,(net/target)*100)}%`} as CSSProperties}><strong>{Math.round((net/target)*100)}%</strong></div></div>
    <div className="calorie-metrics"><div><span>Eaten</span><strong>{food} kcal</strong></div><div><span>Burned</span><strong>{burned} kcal</strong></div><div><span>Target</span><strong>{target} kcal</strong></div></div>
    <SectionHead title="Quick add food"/><form className="calorie-form" onSubmit={addFood}><label><span className="sr-only">Meal or food</span><input placeholder="Meal or food" value={name} onChange={e=>setName(e.target.value)}/></label><label><span className="sr-only">Calories</span><input type="number" placeholder="kcal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button aria-label="Add food entry"><Plus size={17}/></button></form>
    <SectionHead title="Today’s entries" action={`${todayEntries.length} entries`}/><div className="calorie-list">{todayEntries.map(x=><div key={x.id}><span className={x.type}><Flame size={16}/></span><div><strong>{x.name}</strong><small>{x.type==="food"?"Food":"Exercise"}</small></div><b>{x.type==="food"?"+":"-"}{x.calories} kcal</b></div>)}</div>
  </>;
}

function ProfilePage({ profile, setProfile, routines, workouts, onLogout }: AppProps & { onLogout: () => void | Promise<void> }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(profile);
  const save = () => { setProfile(draft); setEditing(false); };
  return <><AppHeader title="Profile" /><div className="profile-hero"><div className="profile-avatar">{profile.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}><Pencil size={15} /> Edit profile</button></div><div className="profile-metrics"><div><span>Current</span><strong>{profile.weight} kg</strong></div><div><span>Target</span><strong>{profile.targetWeight} kg</strong></div><div><span>Frequency</span><strong>{profile.frequency}× week</strong></div></div><SectionHead title="Training profile" /><div className="settings-list"><ProfileRow icon={<Target />} label="Primary goal" value={profile.goal} /><ProfileRow icon={<Activity />} label="Experience" value={profile.experience} /><ProfileRow icon={<Dumbbell />} label="Equipment" value={`${profile.equipment.length} types`} /><ProfileRow icon={<CalendarDays />} label="Saved routines" value={`${routines.length}`} /><ProfileRow icon={<Trophy />} label="Completed workouts" value={`${workouts.length}`} /><ProfileRow icon={<Flame />} label="Calories" value="Open daily tracker" onClick={() => navigate("/calories")} /></div><button className="logout" onClick={onLogout}><LogOut size={18} /> Log out</button>{editing && <Modal onClose={() => setEditing(false)}><div><span className="eyebrow">Profile details</span><h2>Edit your profile</h2><div className="form-grid"><Field label="Name"><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field label="Current weight"><input type="number" value={draft.weight} onChange={e=>setDraft({...draft,weight:+e.target.value})}/></Field><Field label="Target weight"><input type="number" value={draft.targetWeight} onChange={e=>setDraft({...draft,targetWeight:+e.target.value})}/></Field><Field label="Training goal"><select value={draft.goal} onChange={e=>setDraft({...draft,goal:e.target.value})}><option>Build muscle</option><option>Lose fat</option><option>Get stronger</option><option>Stay active</option></select></Field><Field label="Injuries / limitations"><textarea value={draft.injuries} onChange={e=>setDraft({...draft,injuries:e.target.value})}/></Field></div><button className="btn dark wide" onClick={save}><Check size={17}/> Save changes</button></div></Modal>}</>;
}

const equipmentImages: Record<string, string> = {
  All: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=80",
  Machine: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=500&q=80",
  Dumbbell: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=500&q=80",
  Barbell: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=500&q=80",
  Cable: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=500&q=80",
  Bodyweight: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=500&q=80",
  "Resistance Band": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=500&q=80",
  "Smith Machine": "https://images.unsplash.com/photo-1534438097545-a2c22c57f2ad?auto=format&fit=crop&w=500&q=80",
};
function EquipmentImage({ equipment }: { equipment: string }) { return <img src={equipmentImages[equipment] || equipmentImages.All} alt={`${equipment} gym equipment`} loading="lazy" />; }
function ExerciseArt({ exercise, large }: { exercise: typeof exercises[number]; large?: boolean }) { return <div className={large ? "exercise-art large" : "exercise-art"} style={{ background: exercise.color }}><img src={exercise.image} alt={`${exercise.name} demonstration`} loading="lazy" onError={e=>{e.currentTarget.src=equipmentImages[exercise.equipment]||equipmentImages.All}}/><div className="art-shade"/><span className="art-equipment">{exercise.name}</span></div>; }
function SectionHead({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="section-head"><h2>{title}</h2>{action && (onClick ? <button onClick={onClick}>{action}<ChevronRight size={15}/></button> : <span>{action}</span>)}</div>; }
function StatCard({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone: string }) { return <div className={`stat-card ${tone}`}><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function RoutineCard({ routine, onClick }: { routine: Routine; onClick: () => void }) { const preview=exercises.find(x=>x.id===routine.exercises[0]?.exerciseId); return <button className="routine-card" style={{ background: routine.color }} onClick={onClick}><div><span>{routine.day}</span><h3>{routine.name}</h3><p>{routine.focus}</p><small><Clock3 size={13}/>{routine.duration} min · {routine.exercises.length} moves</small></div>{preview&&<img src={preview.image} alt={preview.name}/>}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function MiniInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) { return <label><span>{label}</span><input type="number" value={value} onChange={e=>onChange(+e.target.value)}/></label>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><Search size={28}/><h3>{title}</h3><p>{text}</p></div>; }
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const focusable = node?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
    (focusable ?? node)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus.current?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={onClose}><div ref={dialog} className="modal" role="dialog" aria-modal="true" aria-label="FitFlow dialog" tabIndex={-1} onMouseDown={e=>e.stopPropagation()}><button aria-label="Close dialog" className="modal-close" onClick={onClose}><X size={18}/></button>{children}</div></div>;
}
function ProfileRow({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick?: () => void }) {
  const content = <><span className="row-icon">{icon}</span><strong>{label}</strong><small>{value}</small>{onClick && <ChevronRight size={17}/>}</>;
  return onClick ? <button className="profile-row-button" onClick={onClick}>{content}</button> : <div>{content}</div>;
}

export default App;

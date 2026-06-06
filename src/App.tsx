import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  Activity, ArrowLeft, ArrowRight, Award, BarChart3, CalendarDays, Check, ChevronRight,
  Clock3, Dumbbell, Flame, Home, LogOut, Menu, Pencil, Play, Plus, Search, Settings,
  ShieldCheck, Sparkles, Target, TrendingUp, Trophy, UserRound, Weight, X
} from "lucide-react";
import { exercises, starterCalories, starterRoutines, starterWorkouts } from "./data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { CalorieEntry, Profile, Routine, RoutineExercise, Workout } from "./types";

const defaultProfile: Profile = {
  name: "Alex Morgan", age: 28, height: 178, weight: 76.4, targetWeight: 72,
  goal: "Build muscle", experience: "Intermediate", frequency: 3,
  equipment: ["Dumbbell", "Barbell", "Cable", "Machine"], injuries: "",
};

const readStore = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
};
const readRoutines = () => {
  const saved = readStore<Routine[]>("fitflow-routines", starterRoutines);
  return saved.length && saved.every(r => r.exercises.every(item => exercises.some(ex => ex.id === item.exerciseId))) ? saved : starterRoutines;
};

function App() {
  const [signedIn, setSignedIn] = useState(() => readStore("fitflow-signed-in", false));
  const [onboarded, setOnboarded] = useState(() => readStore("fitflow-onboarded", false));
  const [profile, setProfile] = useState<Profile>(() => readStore("fitflow-profile", defaultProfile));
  const [routines, setRoutines] = useState<Routine[]>(readRoutines);
  const [workouts, setWorkouts] = useState<Workout[]>(() => readStore("fitflow-workouts", starterWorkouts));
  const [calories, setCalories] = useState<CalorieEntry[]>(() => readStore("fitflow-calories", starterCalories));
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSignedIn(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const client = supabase;
    if (!client || !signedIn) return;
    const hydrate = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      const { data } = await client.from("user_states").select("profile,routines,workouts,calories,onboarded").eq("user_id", user.id).maybeSingle() as { data: { profile?: Profile; routines?: Routine[]; workouts?: Workout[]; calories?: CalorieEntry[]; onboarded?: boolean } | null };
      if (data) {
        if (data.profile) setProfile(data.profile as Profile);
        if (data.routines) setRoutines(data.routines as Routine[]);
        if (data.workouts) setWorkouts(data.workouts as Workout[]);
        if (data.calories) setCalories(data.calories as CalorieEntry[]);
        setOnboarded(Boolean(data.onboarded));
      }
      setCloudReady(true);
    };
    hydrate();
  }, [signedIn]);
  useEffect(() => {
    const client = supabase;
    if (!client || !signedIn || !cloudReady) return;
    const sync = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      await client.from("user_states").upsert({
        user_id: user.id, profile, routines, workouts, calories, onboarded, updated_at: new Date().toISOString(),
      });
    };
    const timer = window.setTimeout(sync, 450);
    return () => window.clearTimeout(timer);
  }, [profile, routines, workouts, calories, onboarded, signedIn, cloudReady]);
  useEffect(() => localStorage.setItem("fitflow-signed-in", JSON.stringify(signedIn)), [signedIn]);
  useEffect(() => localStorage.setItem("fitflow-onboarded", JSON.stringify(onboarded)), [onboarded]);
  useEffect(() => localStorage.setItem("fitflow-profile", JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem("fitflow-routines", JSON.stringify(routines)), [routines]);
  useEffect(() => localStorage.setItem("fitflow-workouts", JSON.stringify(workouts)), [workouts]);
  useEffect(() => localStorage.setItem("fitflow-calories", JSON.stringify(calories)), [calories]);

  const app = { profile, setProfile, routines, setRoutines, workouts, setWorkouts, calories, setCalories };
  if (!signedIn) return <Login onSignIn={() => setSignedIn(true)} />;
  if (!onboarded) return <Onboarding profile={profile} onComplete={(value) => { setProfile(value); setOnboarded(true); }} />;

  return (
    <div className="app-shell">
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
        <Route path="/profile" element={<Page><ProfilePage {...app} onLogout={async () => { if (supabase) await supabase.auth.signOut(); setSignedIn(false); setOnboarded(false); }} /></Page>} />
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
  profile: Profile; setProfile: (p: Profile) => void; routines: Routine[]; setRoutines: (r: Routine[]) => void; workouts: Workout[]; setWorkouts: (w: Workout[]) => void; calories: CalorieEntry[]; setCalories: (c: CalorieEntry[]) => void;
};

function HomePage({ profile, routines, workouts, calories }: AppProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const today = routines[0];
  return <>
    <AppHeader profile={profile} />
    <div className="quick-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && navigate(`/exercises?q=${query}`)} placeholder="Search exercises, muscles, equipment" /></div>
    <section className="hero-card">
      <div><span className="pill">Today’s flow</span><h1>{today.name}</h1><p>{today.focus} · {today.exercises.length} exercises</p><button onClick={() => navigate(`/workout/${today.id}`)}>Start workout <Play size={15} fill="currentColor" /></button></div>
      <div className="hero-art"><span /><Dumbbell size={67} /></div>
    </section>
    <SectionHead title="This week" action="View progress" onClick={() => navigate("/progress")} />
    <div className="stat-grid">
      <StatCard icon={<Flame />} value="5 days" label="Current streak" tone="orange" />
      <StatCard icon={<Target />} value={`${workouts.length}/4`} label="Workouts done" tone="blue" />
      <StatCard icon={<TrendingUp />} value="+12%" label="Volume gained" tone="green" />
    </div>
    <button className="calorie-summary" onClick={() => navigate("/calories")}><span><Flame size={19}/></span><div><small>Calories today</small><strong>{calories.filter(x=>x.type==="food").reduce((s,x)=>s+x.calories,0)} eaten · {calories.filter(x=>x.type==="exercise").reduce((s,x)=>s+x.calories,0)} burned</strong></div><ChevronRight size={17}/></button>
    <div className="week-card"><div className="week-score"><strong>75%</strong><span>weekly goal</span></div><div className="days">{["M","T","W","T","F","S","S"].map((d,i) => <div key={i} className={i < 3 ? "done" : i === 4 ? "next" : ""}><i>{i < 3 && <Check size={12} />}</i><span>{d}</span></div>)}</div></div>
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
    <div className="quick-search large"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by exercise, muscle or gear" />{query && <button onClick={() => setQuery("")}><X size={16} /></button>}</div>
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
    <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={19} /></button>
    <div className="detail-hero" style={{ background: exercise.color }}><ExerciseArt exercise={exercise} large /><span className="detail-badge">{exercise.difficulty}</span></div>
    <div className="detail-body"><span className="eyebrow">{exercise.muscle} · {exercise.type}</span><h1>{exercise.name}</h1><div className="detail-meta"><div><Dumbbell /><span>Equipment<strong>{exercise.equipment}</strong></span></div><div><Target /><span>Also works<strong>{exercise.secondary.join(", ") || "Isolation"}</strong></span></div></div>
    <h3>How to do it</h3><ol className="steps">{exercise.instructions.map((x,i) => <li key={x}><b>{i + 1}</b><span>{x}</span></li>)}</ol>
    <div className="safety"><ShieldCheck size={22} /><div><strong>Form check</strong><p>{exercise.safety}</p></div></div>
    <button className={added ? "btn success wide" : "btn dark wide"} onClick={add}>{added ? <><Check size={18} /> Added to {routines[0].name}</> : <><Plus size={18} /> Add to {routines[0].name}</>}</button></div>
  </div>;
}

function RoutinesPage({ profile, routines, setRoutines, workouts }: AppProps) {
  const navigate = useNavigate(); const [generator, setGenerator] = useState(false);
  const today = routines[0];
  const generate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const pool = exercises.filter(x => profile.equipment.includes(x.equipment) || x.equipment === "Bodyweight");
    const generated: Routine = { id: `generated-${Date.now()}`, name: `${profile.goal} Flow`, day: "Saturday", focus: profile.goal, duration: 50, color: "#e3c7ff", exercises: pool.slice(0, 5).map(x => ({ exerciseId: x.id, sets: profile.experience === "Beginner" ? 3 : 4, reps: profile.goal === "Get stronger" ? 6 : 10, rest: 75, weight: 0 })) };
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
    <SectionHead title="Training this week" action={`${workouts.length} completed`} onClick={() => navigate("/progress")} />
    <div className="train-week">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, i) => <div key={day} className={i === 0 ? "active" : i < 3 ? "complete" : ""}><span>{day.slice(0,1)}</span><b>{7+i}</b>{i < 3 && <i><Check size={9}/></i>}</div>)}</div>
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
  if (!routine) return <Navigate to="/routines" replace />;
  const markChanged = () => setSaved(false);
  const update = (index: number, key: keyof RoutineExercise, value: number) => { markChanged(); setRoutines(routines.map(r => r.id !== routine.id ? r : { ...r, exercises: r.exercises.map((ex, i) => i === index ? { ...ex, [key]: value } : ex) })); };
  const remove = (index: number) => { markChanged(); setRoutines(routines.map(r => r.id !== routine.id ? r : { ...r, exercises: r.exercises.filter((_, i) => i !== index) })); };
  const add = (exerciseId: string) => {
    if (routine.exercises.some(x => x.exerciseId === exerciseId)) return;
    markChanged();
    setRoutines(routines.map(r => r.id !== routine.id ? r : { ...r, exercises: [...r.exercises, { exerciseId, sets: 3, reps: 10, rest: 60, weight: 0 }] }));
  };
  const choices = exercises.filter(ex => `${ex.name} ${ex.muscle} ${ex.equipment}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="detail-page routine-detail"><button className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={19} /></button><div className="routine-title" style={{ background: routine.color }}><span className="pill">{routine.day}</span><h1>{routine.name}</h1><p>{routine.focus} · {routine.duration} min</p><div className="big-dumbbell"><Dumbbell size={70} /></div></div><div className="detail-body">
    <div className="routine-edit-head"><div><h2>{routine.exercises.length} exercises</h2><span>Add, remove, or adjust your plan.</span></div><button onClick={() => setAdding(true)}><Plus size={16}/> Add exercise</button></div>
    <div className="routine-exercises">{routine.exercises.map((item, index) => { const ex = exercises.find(x => x.id === item.exerciseId)!; return <div className="routine-exercise" key={`${item.exerciseId}-${index}`}><button className="exercise-preview-button" aria-label={`Preview ${ex.name}`} onClick={() => setPreview(ex)}><ExerciseArt exercise={ex}/><span>View</span></button><div className="routine-exercise-head"><span>{index + 1}. {ex.muscle}</span><strong>{ex.name}</strong></div><button aria-label={`Remove ${ex.name}`} title={`Remove ${ex.name}`} className="remove-exercise" onClick={() => remove(index)}><X size={14} /><span>Remove</span></button><div className="set-fields"><MiniInput label="Sets" value={item.sets} onChange={v => update(index, "sets", v)} /><MiniInput label="Reps" value={item.reps} onChange={v => update(index, "reps", v)} /><MiniInput label="Kg" value={item.weight} onChange={v => update(index, "weight", v)} /><MiniInput label="Rest" value={item.rest} onChange={v => update(index, "rest", v)} /></div></div> })}</div>
    <button className={saved ? "btn success wide update-plan" : "btn ghost wide update-plan"} onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2200); }}>{saved ? <><Check size={17}/> Plan updated</> : <><Pencil size={16}/> Update plan</>}</button>
    <button className="btn dark wide" onClick={() => navigate(`/workout/${routine.id}`)}><Play size={17} fill="white" /> Start workout</button>
  </div>{adding && <Modal onClose={() => { setAdding(false); setQuery(""); }}><div><span className="eyebrow">Edit {routine.name}</span><h2>Add an exercise</h2><div className="quick-search"><Search size={17}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search exercises or equipment"/></div><div className="add-exercise-list">{choices.slice(0,20).map(ex=>{const exists=routine.exercises.some(x=>x.exerciseId===ex.id);return <button key={ex.id} disabled={exists} onClick={()=>add(ex.id)}><ExerciseArt exercise={ex}/><div><strong>{ex.name}</strong><small>{ex.muscle} · {ex.equipment}</small></div><span>{exists?<Check size={16}/>:<Plus size={16}/>}</span></button>})}</div></div></Modal>}{preview && <Modal onClose={() => setPreview(null)}><div className="exercise-pop"><img src={preview.image} alt={`${preview.name} demonstration`}/><span className="eyebrow">{preview.muscle} · {preview.equipment}</span><h2>{preview.name}</h2><p>{preview.safety}</p><button className="btn dark wide" onClick={() => setPreview(null)}>Close preview</button></div></Modal>}</div>;
}

function ActiveWorkout({ routines, workouts, setWorkouts }: AppProps) {
  const { id } = useParams(); const navigate = useNavigate(); const routine = routines.find(x => x.id === id);
  const [active, setActive] = useState(0); const [done, setDone] = useState<Record<string, boolean>>({}); const [finished, setFinished] = useState(false);
  if (!routine) return <Navigate to="/routines" replace />;
  const item = routine.exercises[active]; const ex = exercises.find(x => x.id === item.exerciseId)!;
  const toggle = (set: number) => setDone({ ...done, [`${active}-${set}`]: !done[`${active}-${set}`] });
  const complete = () => { const volume = routine.exercises.reduce((sum, x) => sum + x.sets * x.reps * x.weight, 0); setWorkouts([{ id: `w-${Date.now()}`, routineId: routine.id, date: new Date().toISOString().slice(0,10), duration: routine.duration, volume, completed: 100, personalBests: 1 }, ...workouts]); setFinished(true); };
  if (finished) return <div className="finish-page"><div className="finish-icon"><Trophy size={52} /></div><span className="eyebrow">Workout complete</span><h1>Strong work.</h1><p>You showed up and finished {routine.name}.</p><div className="finish-stats"><StatCard icon={<Clock3 />} value={`${routine.duration} min`} label="Duration" tone="orange" /><StatCard icon={<Weight />} value={`${(routine.exercises.reduce((s,x) => s+x.sets*x.reps*x.weight,0)/1000).toFixed(1)}t`} label="Volume" tone="blue" /><StatCard icon={<Award />} value="1 new" label="Personal best" tone="green" /></div><button className="btn dark" onClick={() => navigate("/progress")}>View progress <ArrowRight size={17} /></button></div>;
  return <div className="workout-page"><header><button onClick={() => navigate(-1)}><X size={20} /></button><div><span>{routine.name}</span><strong>{active + 1} of {routine.exercises.length}</strong></div><button className="text-button" onClick={complete}>Finish</button></header><div className="workout-progress"><i style={{ width: `${((active + 1) / routine.exercises.length) * 100}%` }} /></div><main><ExerciseArt exercise={ex} large /><span className="eyebrow">{ex.muscle} · {ex.equipment}</span><h1>{ex.name}</h1><p className="form-tip">{ex.safety}</p><div className="set-table"><div className="set-row heading"><span>Set</span><span>Previous</span><span>Kg</span><span>Reps</span><span /></div>{Array.from({ length: item.sets }).map((_, i) => <div className={done[`${active}-${i}`] ? "set-row complete" : "set-row"} key={i}><b>{i + 1}</b><span>{item.weight} × {item.reps}</span><input defaultValue={item.weight} type="number" /><input defaultValue={item.reps} type="number" /><button onClick={() => toggle(i)}><Check size={17} /></button></div>)}</div><button className="add-set"><Plus size={16} /> Add set</button></main><footer><button className="btn ghost" disabled={active === 0} onClick={() => setActive(active - 1)}><ArrowLeft size={17} /> Previous</button>{active < routine.exercises.length - 1 ? <button className="btn dark" onClick={() => setActive(active + 1)}>Next exercise <ArrowRight size={17} /></button> : <button className="btn dark" onClick={complete}>Finish workout <Check size={17} /></button>}</footer></div>;
}

function ProgressPage({ profile, workouts, routines }: AppProps) {
  const max = Math.max(...workouts.map(x => x.volume));
  return <><AppHeader title="Your progress" /><p className="page-intro">Small wins, clearly visible.</p><div className="progress-hero"><div><span className="eyebrow">Training volume</span><h1>{(workouts.reduce((s,x) => s+x.volume,0)/1000).toFixed(1)}t</h1><p>+12% from last month</p></div><TrendingUp size={42} /></div><div className="chart-card"><SectionHead title="Last 7 sessions" action="Volume (kg)" /><div className="bar-chart">{[2800,3600,3300,...workouts.map(x=>x.volume)].slice(-7).map((x,i) => <div key={i}><span style={{ height: `${(x/max)*100}%` }} className={i === 6 ? "current" : ""} /><small>{["M","T","W","T","F","S","S"][i]}</small></div>)}</div></div><div className="stat-grid"><StatCard icon={<Flame />} value="5 days" label="Best streak" tone="orange" /><StatCard icon={<Trophy />} value="7" label="Personal bests" tone="green" /><StatCard icon={<Activity />} value="12" label="Workouts" tone="blue" /></div><SectionHead title="Body progress" action="Last 30 days" /><div className="body-progress"><div><span>Current weight</span><strong>{profile.weight}<small> kg</small></strong><em>-1.8 kg</em></div><div className="weight-line"><i /><i /><i /><i /><i /></div><div className="target-row"><span>Start 78.2 kg</span><span>Goal {profile.targetWeight} kg</span></div></div><SectionHead title="Recent workouts" action={`${workouts.length} logged`} /><div className="history-list">{workouts.map(w => { const r=routines.find(x=>x.id===w.routineId) || {name:"Custom Flow",focus:"Full body"}; return <div key={w.id}><span className="history-icon"><Dumbbell size={19} /></span><div><strong>{r.name}</strong><small>{w.date} · {w.duration} min</small></div><div><b>{(w.volume/1000).toFixed(1)}t</b><small>{w.personalBests ? `${w.personalBests} PB` : "Complete"}</small></div></div>})}</div></>;
}

function CaloriesPage({ calories, setCalories, workouts }: AppProps) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState("");
  const food = calories.filter(x=>x.type==="food").reduce((s,x)=>s+x.calories,0);
  const burned = calories.filter(x=>x.type==="exercise").reduce((s,x)=>s+x.calories,0) + workouts.reduce((s,x)=>s+(x.calories||0),0);
  const target = 2200; const net = food - burned;
  const addFood = (e: FormEvent) => { e.preventDefault(); if(!name || !amount) return; setCalories([{id:`c-${Date.now()}`,date:new Date().toISOString().slice(0,10),name,calories:+amount,type:"food"},...calories]); setName(""); setAmount(""); };
  return <><AppHeader title="Calories"/><p className="page-intro">A simple energy view, connected to your training.</p>
    <div className="calorie-hero"><div><span>Net calories</span><h1>{net}</h1><small>{target-net} kcal remaining</small></div><div className="calorie-ring" style={{"--fill":`${Math.min(100,(net/target)*100)}%`} as CSSProperties}><strong>{Math.round((net/target)*100)}%</strong></div></div>
    <div className="calorie-metrics"><div><span>Eaten</span><strong>{food} kcal</strong></div><div><span>Burned</span><strong>{burned} kcal</strong></div><div><span>Target</span><strong>{target} kcal</strong></div></div>
    <SectionHead title="Quick add food"/><form className="calorie-form" onSubmit={addFood}><input placeholder="Meal or food" value={name} onChange={e=>setName(e.target.value)}/><input type="number" placeholder="kcal" value={amount} onChange={e=>setAmount(e.target.value)}/><button><Plus size={17}/></button></form>
    <SectionHead title="Today’s entries" action={`${calories.length} entries`}/><div className="calorie-list">{calories.map(x=><div key={x.id}><span className={x.type}><Flame size={16}/></span><div><strong>{x.name}</strong><small>{x.type==="food"?"Food":"Exercise"}</small></div><b>{x.type==="food"?"+":"-"}{x.calories} kcal</b></div>)}</div>
  </>;
}

function ProfilePage({ profile, setProfile, routines, workouts, onLogout }: AppProps & { onLogout: () => void | Promise<void> }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(profile);
  const save = () => { setProfile(draft); setEditing(false); };
  return <><AppHeader title="Profile" /><div className="profile-hero"><div className="profile-avatar">{profile.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}><Pencil size={15} /> Edit profile</button></div><div className="profile-metrics"><div><span>Current</span><strong>{profile.weight} kg</strong></div><div><span>Target</span><strong>{profile.targetWeight} kg</strong></div><div><span>Frequency</span><strong>{profile.frequency}× week</strong></div></div><SectionHead title="Training profile" /><div className="settings-list"><ProfileRow icon={<Target />} label="Primary goal" value={profile.goal} /><ProfileRow icon={<Activity />} label="Experience" value={profile.experience} /><ProfileRow icon={<Dumbbell />} label="Equipment" value={`${profile.equipment.length} types`} /><ProfileRow icon={<CalendarDays />} label="Saved routines" value={`${routines.length}`} /><ProfileRow icon={<Trophy />} label="Completed workouts" value={`${workouts.length}`} /></div><button className="logout" onClick={onLogout}><LogOut size={18} /> Log out</button>{editing && <Modal onClose={() => setEditing(false)}><div><span className="eyebrow">Profile details</span><h2>Edit your profile</h2><div className="form-grid"><Field label="Name"><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field label="Current weight"><input type="number" value={draft.weight} onChange={e=>setDraft({...draft,weight:+e.target.value})}/></Field><Field label="Target weight"><input type="number" value={draft.targetWeight} onChange={e=>setDraft({...draft,targetWeight:+e.target.value})}/></Field><Field label="Training goal"><select value={draft.goal} onChange={e=>setDraft({...draft,goal:e.target.value})}><option>Build muscle</option><option>Lose fat</option><option>Get stronger</option><option>Stay active</option></select></Field><Field label="Injuries / limitations"><textarea value={draft.injuries} onChange={e=>setDraft({...draft,injuries:e.target.value})}/></Field></div><button className="btn dark wide" onClick={save}><Check size={17}/> Save changes</button></div></Modal>}</>;
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
function SectionHead({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="section-head"><h2>{title}</h2>{action && <button onClick={onClick}>{action}{onClick && <ChevronRight size={15}/>}</button>}</div>; }
function StatCard({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone: string }) { return <div className={`stat-card ${tone}`}><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function RoutineCard({ routine, onClick }: { routine: Routine; onClick: () => void }) { const preview=exercises.find(x=>x.id===routine.exercises[0]?.exerciseId); return <button className="routine-card" style={{ background: routine.color }} onClick={onClick}><div><span>{routine.day}</span><h3>{routine.name}</h3><p>{routine.focus}</p><small><Clock3 size={13}/>{routine.duration} min · {routine.exercises.length} moves</small></div>{preview&&<img src={preview.image} alt={preview.name}/>}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function MiniInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) { return <label><span>{label}</span><input type="number" value={value} onChange={e=>onChange(+e.target.value)}/></label>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><Search size={28}/><h3>{title}</h3><p>{text}</p></div>; }
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={18}/></button>{children}</div></div>; }
function ProfileRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div><span className="row-icon">{icon}</span><strong>{label}</strong><small>{value}</small><ChevronRight size={17}/></div>; }

export default App;

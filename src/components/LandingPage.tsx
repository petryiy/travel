"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TRAVEL_IMAGES } from "@/lib/travel-images";

const DomeGallery = dynamic(() => import("@/components/hero/DomeGallery"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

type View = "landing" | "login" | "register";

const DESTINATIONS = ["Paris", "Tokyo", "Bali", "Rome", "Santorini", "Bangkok", "Sydney", "Dubai", "Kyoto", "Maldives"];

// Nature healing palette
const BG = "#F2F5EE";

interface LandingPageProps {
  initialView?: View;
  callbackUrl?: string;
}

export function LandingPage({ initialView = "landing", callbackUrl = "/dashboard" }: LandingPageProps) {
  const router = useRouter();

  const [view, setView] = useState<View>(initialView);
  const [contentVisible, setContentVisible] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [destIndex, setDestIndex] = useState(0);
  const [destVisible, setDestVisible] = useState(true);

  useEffect(() => {
    if (view !== "landing") return;
    const interval = setInterval(() => {
      setDestVisible(false);
      setTimeout(() => {
        setDestIndex((i) => (i + 1) % DESTINATIONS.length);
        setDestVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, [view]);

  function switchView(next: View) {
    setError(null);
    setEmail("");
    setPassword("");
    setName("");
    setContentVisible(false);
    setTimeout(() => {
      setView(next);
      setContentVisible(true);
    }, 160);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    setIsLoading(false);
    if (result?.error) { setError("Invalid email or password."); return; }
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl });
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Registration failed."); setIsLoading(false); return; }
    const result = await signIn("credentials", { email, password, redirect: false });
    setIsLoading(false);
    if (result?.error) { switchView("login"); return; }
    router.push("/dashboard");
    router.refresh();
  }

  const inputCls = "w-full rounded-xl bg-[#F6FAF4] border border-[#C8D9BF] px-4 py-2.5 text-sm text-[#2A3226] placeholder:text-[#A8B8A0] outline-none focus:border-[#68A058] focus:ring-2 focus:ring-[#68A058]/20 transition";
  const labelCls = "block text-[11px] font-light tracking-[0.12em] uppercase text-[#96AB8E]";
  const primaryBtn = "group w-full flex items-center justify-center gap-3 rounded-full bg-[#68A058] pl-7 pr-2 py-2.5 text-sm font-medium tracking-wide text-white transition-all duration-500 hover:bg-[#5B9249] hover:shadow-[0_6px_24px_rgba(104,160,88,0.38)] disabled:opacity-50 active:scale-[0.98]";
  const arrowIcon = (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:scale-105">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
    </span>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden" style={{ background: BG }}>
      {/* Left — DomeGallery (never unmounts = keeps spinning across view changes) */}
      <div className="relative hidden lg:block lg:h-screen overflow-hidden lg:w-[70%]">
        <DomeGallery
          images={TRAVEL_IMAGES}
          fit={1}
          minRadius={2400}
          maxRadius={2400}
          segments={40}
          grayscale={false}
          overlayBlurColor={BG}
          autoRotateSpeed={0.02}
        />
        <div
          className="absolute top-0 right-0 h-full pointer-events-none z-10"
          style={{ width: "clamp(80px, 15vw, 200px)", background: `linear-gradient(to right, transparent, ${BG})` }}
        />
      </div>

      {/* Right — panel */}
      <div className="relative h-screen w-full lg:w-[30%] flex flex-col items-center justify-center px-6 sm:px-8 lg:px-10 overflow-y-auto py-10">
        <div className="animate-fade-blur w-full flex flex-col items-center" style={{ animationDelay: "0.05s" }}>
          <div
            className="w-full flex flex-col items-center"
            style={{
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 0.16s ease, transform 0.16s ease",
            }}
          >
            {view === "landing" && (
              <LandingContent
                destIndex={destIndex}
                destVisible={destVisible}
                onLogin={() => switchView("login")}
                onRegister={() => switchView("register")}
              />
            )}

            {view === "login" && (
              <AuthCard
                title="Welcome back"
                subtitle="Continue your journey"
                onBack={() => switchView("landing")}
              >
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-2.5 rounded-full border border-[#C8D9BF] bg-white px-4 py-2.5 text-sm font-medium text-[#486040] transition-all duration-300 hover:bg-[#EEF5EA] hover:border-[#68A058]/50 active:scale-[0.98]"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <Divider />

                <form onSubmit={handleLogin} className="space-y-3.5">
                  <Field label="Email" labelCls={labelCls}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
                  </Field>
                  <Field label="Password" labelCls={labelCls}>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={inputCls} />
                  </Field>
                  {error && <p className="text-[12px] text-rose-500/90">{error}</p>}
                  <button type="submit" disabled={isLoading} className={primaryBtn}>
                    {isLoading ? "Signing in…" : "Sign in"}
                    {arrowIcon}
                  </button>
                </form>

                <p className="text-center text-[12px] text-[#96AB8E]">
                  No account?{" "}
                  <button onClick={() => switchView("register")} className="text-[#486040] hover:text-[#2A3226] font-medium transition-colors duration-200">
                    Sign up
                  </button>
                </p>
              </AuthCard>
            )}

            {view === "register" && (
              <AuthCard
                title="Create account"
                subtitle="Start planning your adventures"
                onBack={() => switchView("landing")}
              >
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <Field label="Name" labelCls={labelCls}>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className={inputCls} />
                  </Field>
                  <Field label="Email" labelCls={labelCls}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
                  </Field>
                  <Field label="Password" labelCls={labelCls}>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={inputCls} />
                  </Field>
                  {error && <p className="text-[12px] text-rose-500/90">{error}</p>}
                  <button type="submit" disabled={isLoading} className={primaryBtn}>
                    {isLoading ? "Creating account…" : "Create account"}
                    {arrowIcon}
                  </button>
                </form>

                <p className="text-center text-[12px] text-[#96AB8E]">
                  Already have an account?{" "}
                  <button onClick={() => switchView("login")} className="text-[#486040] hover:text-[#2A3226] font-medium transition-colors duration-200">
                    Sign in
                  </button>
                </p>
              </AuthCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LandingContent({
  destIndex,
  destVisible,
  onLogin,
  onRegister,
}: {
  destIndex: number;
  destVisible: boolean;
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-[220px]">
      <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(104,160,88,0.22)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/MeetU_Logo.jpg" alt="MeetU Logo" className="w-full h-full object-cover" />
      </div>

      <h1
        className="text-5xl sm:text-6xl lg:text-7xl tracking-tight text-center travel-gradient-text"
        style={{
          opacity: 0,
          animation: "fade-blur-in 0.8s cubic-bezier(0.32,0.72,0,1) 0.1s forwards, travel-gradient-shift 6s ease infinite",
        }}
      >
        Travel Planner
      </h1>

      <p className="animate-fade-blur text-[13px] font-light tracking-[0.15em] uppercase text-[#96AB8E] text-center -mt-2" style={{ animationDelay: "0.2s" }}>
        AI-powered itineraries
      </p>

      <div className="animate-fade-blur flex items-center justify-center gap-1.5 h-6 -mt-2" style={{ animationDelay: "0.3s" }}>
        <span className="text-[13px] tracking-[0.15em] uppercase font-light text-[#B2C4A8]">for</span>
        <div className="relative h-5 w-[80px] overflow-hidden">
          <span
            className="text-[13px] tracking-[0.15em] uppercase font-light text-[#486040] absolute left-0 transition-all duration-300"
            style={{
              opacity: destVisible ? 1 : 0,
              transform: destVisible ? "translateY(0)" : "translateY(-12px)",
              filter: destVisible ? "blur(0)" : "blur(4px)",
            }}
          >
            {DESTINATIONS[destIndex]}
          </span>
        </div>
      </div>

      <p className="animate-fade-blur text-base font-light text-[#637860] text-center leading-relaxed" style={{ animationDelay: "0.4s" }}>
        Plan your next adventure with personalized AI itineraries.
      </p>

      <div className="animate-fade-blur flex flex-col gap-3 w-full mt-1" style={{ animationDelay: "0.5s" }}>
        <button
          onClick={onLogin}
          className="group flex items-center justify-center gap-3 rounded-full bg-[#68A058] pl-7 pr-2 py-2.5 text-sm font-medium tracking-wide text-white transition-all duration-500 hover:bg-[#5B9249] hover:shadow-[0_6px_28px_rgba(104,160,88,0.42)] active:scale-[0.98]"
        >
          Log in
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </button>

        <button
          onClick={onRegister}
          className="flex items-center justify-center rounded-full border border-[#C8D9BF] bg-white px-7 py-2.5 text-sm font-medium tracking-wide text-[#486040] transition-all duration-300 hover:bg-[#EEF5EA] hover:border-[#68A058]/50 active:scale-[0.98]"
        >
          Sign up
        </button>

        <Link
          href="/guest"
          className="text-center text-[13px] tracking-[0.1em] uppercase font-light text-[#A8B8A0] hover:text-[#637860] transition-colors duration-300 py-1"
        >
          Continue as guest
        </Link>
      </div>
    </div>
  );
}

function AuthCard({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center w-full max-w-[300px] gap-5">
      <button onClick={onBack} className="w-16 h-16 rounded-2xl overflow-hidden hover:opacity-85 transition-opacity shadow-[0_4px_16px_rgba(104,160,88,0.18)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/MeetU_Logo.jpg" alt="MeetU" className="w-full h-full object-cover" />
      </button>

      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[#2A3226]">{title}</h1>
        <p className="text-[13px] text-[#96AB8E] mt-1">{subtitle}</p>
      </div>

      <div className="w-full rounded-2xl border border-[#D0DECA] bg-white shadow-[0_4px_24px_rgba(104,160,88,0.09)] p-5 space-y-4">
        {children}
      </div>

      <button
        onClick={onBack}
        className="text-[11px] tracking-[0.12em] uppercase font-light text-[#A8B8A0] hover:text-[#637860] transition-colors duration-300"
      >
        ← Back
      </button>
    </div>
  );
}

function Field({ label, labelCls, children }: { label: string; labelCls: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <hr className="flex-1 border-[#D8E5D0]" />
      <span className="text-[10px] tracking-[0.15em] uppercase text-[#B2C4A8]">or</span>
      <hr className="flex-1 border-[#D8E5D0]" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

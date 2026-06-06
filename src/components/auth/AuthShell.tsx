"use client";

import { ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TRAVEL_IMAGES } from "@/lib/travel-images";

const DomeGallery = dynamic(() => import("@/components/hero/DomeGallery"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row" style={{ background: "#0a0f1a" }}>
      {/* Left — DomeGallery */}
      <div className="relative hidden overflow-hidden lg:block lg:h-dvh lg:w-[70%]">
        <DomeGallery
          images={TRAVEL_IMAGES}
          fit={1}
          minRadius={2400}
          maxRadius={2400}
          segments={40}
          grayscale={false}
          overlayBlurColor="#0a0f1a"
          autoRotateSpeed={0.02}
        />
        <div
          className="absolute top-0 right-0 h-full pointer-events-none z-10"
          style={{
            width: "clamp(80px, 15vw, 200px)",
            background: "linear-gradient(to right, transparent, #0a0f1a)",
          }}
        />
      </div>

      {/* Right — Auth panel */}
      <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-y-auto px-6 py-10 sm:px-8 lg:w-[30%] lg:px-10">
        <div className="animate-fade-blur flex flex-col items-center w-full max-w-[300px] gap-6" style={{ animationDelay: "0.05s" }}>

          {/* Logo */}
          <Link href="/" className="w-16 h-16 rounded-2xl overflow-hidden block hover:opacity-85 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MeetU_Logo.jpg" alt="MeetU" className="w-full h-full object-cover" />
          </Link>

          {/* Heading */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white/90">{title}</h1>
            <p className="text-[13px] text-white/40 mt-1">{subtitle}</p>
          </div>

          {/* Form card */}
          <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4">
            {children}
          </div>

          {/* Back */}
          <Link
            href="/"
            className="text-[11px] tracking-[0.12em] uppercase font-light text-white/25 hover:text-white/50 transition-colors duration-300"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

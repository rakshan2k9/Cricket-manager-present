import { useEffect, useState } from 'react';

const STATUS_STEPS = [
  'Connecting to CM27 Operations Core...',
  'Loading Verified IPL, Int’l, BBL & Hundred Players...',
  'Hydrating 36 Club & National Team Crests...',
  'Synchronizing Real-Time WebSocket World...',
];

export function LoadingScreen({
  message,
  sublabel,
}: {
  message?: string;
  sublabel?: string;
  progress?: number;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((i) => (i + 1) % STATUS_STEPS.length);
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0F14] text-slate-100 flex flex-col justify-between overflow-hidden select-none">
      {/* Subtle angled stadium crease geometry */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <line x1="250" y1="0" x2="120" y2="900" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="760" y1="0" x2="650" y2="900" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <line x1="1320" y1="0" x2="1180" y2="900" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      </svg>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 62% 48% at 22% 30%, rgba(148, 163, 184, 0.16), transparent 70%)',
        }}
      />

      <div />

      {/* Center Minimal CM27 Emblem */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center cm27-view-enter">
        <p className="text-[11px] sm:text-xs font-mono tracking-[0.38em] text-slate-400 uppercase mb-2">
          CRICKET MANAGER
        </p>

        <div className="flex items-baseline justify-center tracking-tight leading-none">
          <span className="font-condensed text-7xl sm:text-8xl font-extrabold text-white tracking-tight">
            CM
          </span>
          <span className="font-condensed text-7xl sm:text-8xl font-extrabold text-[#EAB308] tracking-tight">
            27
          </span>
        </div>

        <div className="w-52 sm:w-64 h-[2px] mt-4 bg-white/10 rounded-full overflow-hidden flex justify-center">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-slate-200 to-transparent animate-cm27-gold-line" />
        </div>

        <p className="mt-6 text-xs text-slate-400 font-mono tracking-wider">
          {message || STATUS_STEPS[stepIndex]}
        </p>
        {sublabel && (
          <p className="mt-1 text-[11px] text-slate-500 font-mono">{sublabel}</p>
        )}
      </div>

      {/* Subtle Footer */}
      <div className="relative z-10 pb-6 px-6 text-center text-[11px] font-mono text-slate-500 tracking-wider">
        CRICKET MANAGER 27 · GLOBAL OPERATIONS EDITION
      </div>
    </div>
  );
}

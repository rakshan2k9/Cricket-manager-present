import { ArrowRight, Globe2, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginView() {
  const { signInWithGoogle, authError } = useAuth();

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col justify-center px-4 py-10 relative overflow-hidden">
      <img
        src="/src/assets/images/stadium_hero_1794579233002.jpg"
        alt="Cricket Stadium Operations"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover opacity-10"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0C0F14]/45 to-[#0C0F14]/85" />

      <div className="relative z-10 max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Pitch & Brand Column */}
        <div className="lg:col-span-7 space-y-5">
          <div className="text-[11px] font-mono uppercase tracking-[0.28em] text-[#EAB308]">
            CRICKET MANAGER 27 · MULTIPLAYER EDITION
          </div>

          <div className="flex items-baseline leading-none">
            <span className="font-condensed text-6xl sm:text-7xl font-extrabold text-white tracking-tight">
              CM
            </span>
            <span className="font-condensed text-6xl sm:text-7xl font-extrabold text-[#EAB308] tracking-tight">
              27
            </span>
          </div>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
            Take charge of franchises and national sides across IPL, PSL, SA20, Big Bash League, The Hundred, and Internationals. Bid in real-time multiplayer marquee auctions, appoint legacy coaching staff, deploy scouts, and simulate T20, ODI, 100-Ball &amp; Test matches.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            {[
              { icon: Users, label: 'Multiplayer & Friends', color: 'text-[#93E6EE]' },
              { icon: Trophy, label: 'Authentic Real Stars', color: 'text-[#EAB308]' },
              { icon: Globe2, label: '6 Global Leagues', color: 'text-sky-300' },
              { icon: ShieldCheck, label: 'Live Auction Engine', color: 'text-slate-200' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="p-3 cm27-panel space-y-1.5"
                >
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  <div className="text-xs font-semibold text-white">{item.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sign-In Card */}
        <div className="lg:col-span-5">
          <div className="cm27-panel p-7 shadow-2xl space-y-6">
            <div>
              <h2 className="font-condensed text-3xl font-bold text-white uppercase tracking-wide">
                MANAGER SIGN IN
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Authenticate with Google to access persistent Cloud SQL multiplayer leagues and your manager career dossier.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {authError}
              </div>
            )}

            <button
              onClick={signInWithGoogle}
              className="cm27-btn-3d w-full py-3 px-4 rounded font-bold text-sm flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            <div className="pt-2 border-t border-white/[0.07] text-[11px] text-slate-500 font-mono flex items-center justify-between">
              <span>PERSISTENT POSTGRESQL</span>
              <span>REAL-TIME WS SYNC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

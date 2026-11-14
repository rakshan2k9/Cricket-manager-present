import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Coins,
  Compass,
  Flag,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  AVATAR_PRESETS,
  COACH_BACKGROUNDS,
  COACH_EXPERIENCES,
  COACHING_STYLES,
  COUNTRIES,
  CURRENCIES,
  MONTHS,
} from '../utils/format';
import type { CurrencyCode, ManagerProfile } from '../types/game';
import { CountryFlag } from '../components/CountryFlag';
import { ManagerBadge } from '../components/ManagerBadge';

export function ManagerProfileSetupView({ onComplete }: { onComplete?: () => void }) {
  const { suggestedName, setProfile } = useAuth();
  const nameParts = (suggestedName || '').trim().split(/\s+/);
  const [activeSubTab, setActiveSubTab] = useState<'MANAGER' | 'PATH' | 'CLUB' | 'CONTRACT'>('MANAGER');

  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [preferredName, setPreferredName] = useState(suggestedName || '');
  const [country, setCountry] = useState('India');
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>('INR');
  const [birthYear, setBirthYear] = useState(1993);
  const [birthMonth, setBirthMonth] = useState('MAY');
  const [birthDay, setBirthDay] = useState(7);
  const [coachExperience, setCoachExperience] = useState('REGIONAL EXPERIENCE');
  const [coachBackground, setCoachBackground] = useState('TACTICAL ANALYST');
  const [coachingStyle, setCoachingStyle] = useState('BALANCED TACTICAL');
  const [favoriteFormat, setFavoriteFormat] = useState<'T20' | 'ODI' | 'Test'>('T20');
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0].url);
  const [expOpen, setExpOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpOpen(false);
        setCountryOpen(false);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const tabs = ['MANAGER', 'PATH', 'CLUB', 'CONTRACT'] as const;
      const idx = tabs.indexOf(activeSubTab);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveSubTab(tabs[(idx + 1) % tabs.length]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveSubTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSubTab]);

  const years = Array.from({ length: 45 }, (_, i) => 2005 - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const displayPreview =
    preferredName.trim() ||
    [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim() ||
    'CM27 Manager';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const display =
      preferredName.trim() ||
      [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();

    if (display.length < 2) {
      setError('Enter your Preferred Name or First & Last Name (min 2 characters).');
      setActiveSubTab('MANAGER');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{ profile: ManagerProfile }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          managerName: display,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          preferredName: preferredName.trim() || display,
          country,
          preferredCurrency,
          birthYear,
          birthMonth,
          birthDay,
          coachExperience,
          coachBackground,
          coachingStyle,
          favoriteFormat,
          avatarUrl,
          bio: `${coachExperience} · ${coachBackground} · ${coachingStyle}`,
        }),
      });
      setProfile(data.profile);
      if (onComplete) onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save manager profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col justify-center px-4 sm:px-10 py-8 relative overflow-hidden cm27-view-enter">
      <div className="relative z-10 w-full max-w-3xl mx-auto">
        {/* Top Header */}
        <div className="mb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <ManagerBadge name={displayPreview} country={country} accent={avatarUrl} size="md" />
              <div>
                <h1 className="font-condensed text-4xl sm:text-5xl font-extrabold tracking-tight text-white uppercase leading-none">
                  MANAGER INFO
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Cricket Manager 27 · Career &amp; Club Operations Passport
                </p>
              </div>
            </div>
            <span className="font-condensed text-2xl font-extrabold text-white">
              CM<span className="text-[#EAB308]">27</span>
            </span>
          </div>

          {/* Sub-tab Strip: MANAGER | PATH | CLUB | CONTRACT */}
          <div className="flex items-center gap-6 mt-4 border-b border-white/10">
            {(['MANAGER', 'PATH', 'CLUB', 'CONTRACT'] as const).map((tab) => {
              const active = activeSubTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveSubTab(tab)}
                  className={`pb-2.5 text-xs font-condensed tracking-[0.14em] uppercase transition-colors cursor-pointer relative ${
                    active ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab}
                  {active && (
                    <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-white" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs text-amber-400/90">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Fill your managerial dossier carefully — career settings remain editable in Office.</span>
          </div>
        </div>

        {/* Main Card Form */}
        <form
          onSubmit={handleSubmit}
          className="cm27-panel shadow-2xl overflow-visible"
        >
          {activeSubTab === 'MANAGER' && (
            <div className="divide-y divide-white/[0.06]">
              {/* First Name */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#93E6EE]/80" />
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  className="sm:w-72 bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm text-white font-semibold tracking-wide focus:outline-none transition-colors"
                />
              </div>

              {/* Last Name */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[#93E6EE]/80" />
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className="sm:w-72 bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm text-white font-semibold tracking-wide focus:outline-none transition-colors"
                />
              </div>

              {/* Preferred Name */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-amber-400/80" />
                  Preferred Name
                </label>
                <input
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="Display Alias"
                  className="sm:w-72 bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm text-white font-semibold tracking-wide focus:outline-none transition-colors"
                />
              </div>

              {/* Nationality with SVG Country Flags */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <Flag className="w-3.5 h-3.5 text-cyan-400/80" />
                  Nationality
                </label>
                <div className="sm:w-72 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setCountryOpen((o) => !o);
                      setExpOpen(false);
                    }}
                    className={`w-full flex items-center justify-between bg-[#0C0F14] border rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold text-white cursor-pointer transition-colors ${
                      countryOpen
                        ? 'border-[#93E6EE]'
                        : 'border-white/15 hover:border-white/30'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <CountryFlag country={country} size="sm" />
                      <span>{country}</span>
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {countryOpen && (
                    <div className="absolute right-0 left-0 mt-1.5 z-40 bg-[#14191F] border border-white/15 rounded-lg shadow-2xl max-h-60 overflow-y-auto py-1">
                      {COUNTRIES.map((c) => {
                        const selected = country === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setCountry(c);
                              setCountryOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2.5 cursor-pointer transition-colors ${
                              selected
                                ? 'bg-[#212A38] text-white'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <CountryFlag country={c} size="sm" />
                            <span>{c}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Preferred Currency */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-amber-400/80" />
                  Preferred Currency
                </label>
                <div className="sm:w-72 relative">
                  <select
                    value={preferredCurrency}
                    onChange={(e) => setPreferredCurrency(e.target.value as CurrencyCode)}
                    className="w-full appearance-none bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
                  >
                    {CURRENCIES.map((cur) => (
                      <option key={cur.code} value={cur.code} className="bg-[#0C0F14]">
                        {cur.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Birth Year */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Birth Year
                </label>
                <div className="sm:w-72 relative">
                  <select
                    value={birthYear}
                    onChange={(e) => setBirthYear(Number(e.target.value))}
                    className="w-full appearance-none bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
                  >
                    {years.map((y) => (
                      <option key={y} value={y} className="bg-[#0C0F14]">
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Birth Month */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Birth Month
                </label>
                <div className="sm:w-72 relative">
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className="w-full appearance-none bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m} className="bg-[#0C0F14]">
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Birth Day */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Birth Day
                </label>
                <div className="sm:w-72 relative">
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(Number(e.target.value))}
                    className="w-full appearance-none bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
                  >
                    {days.map((d) => (
                      <option key={d} value={d} className="bg-[#0C0F14]">
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Coach Experience */}
              <div
                className={`px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative transition-colors ${
                  expOpen
                    ? 'bg-white/[0.04]'
                    : ''
                }`}
              >
                <label className="text-xs sm:text-sm text-white font-medium flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-[#93E6EE]" />
                  Coach Experience
                </label>
                <div className="sm:w-72 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setExpOpen((o) => !o);
                      setCountryOpen(false);
                    }}
                    className={`w-full flex items-center justify-between bg-[#0C0F14] border rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white cursor-pointer ${
                      expOpen
                        ? 'border-[#93E6EE]'
                        : 'border-white/15 hover:border-white/30'
                    }`}
                  >
                    <span>{coachExperience}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {expOpen && (
                    <div className="absolute right-0 left-0 mt-1.5 z-30 bg-[#14191F] border border-white/15 rounded-lg shadow-2xl overflow-hidden py-1">
                      {COACH_EXPERIENCES.map((exp) => {
                        const selected = coachExperience === exp;
                        return (
                          <button
                            key={exp}
                            type="button"
                            onClick={() => {
                              setCoachExperience(exp);
                              setExpOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs font-semibold tracking-wide cursor-pointer transition-colors ${
                              selected
                                ? 'bg-[#212A38] text-white border border-[#93E6EE]/50'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            {exp}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Coach Background */}
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-amber-400/80" />
                  Coach Background
                </label>
                <div className="sm:w-72 relative">
                  <select
                    value={coachBackground}
                    onChange={(e) => setCoachBackground(e.target.value)}
                    className="w-full appearance-none bg-[#0C0F14] border border-white/15 focus:border-[#93E6EE] rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
                  >
                    {COACH_BACKGROUNDS.map((bg) => (
                      <option key={bg} value={bg} className="bg-[#0C0F14]">
                        {bg}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'PATH' && (
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-condensed uppercase tracking-wider text-slate-400 mb-2">
                  Tactical Philosophy &amp; Coaching Style
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {COACHING_STYLES.map((style) => {
                    const active = coachingStyle === style;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setCoachingStyle(style)}
                        className={`p-3 rounded-lg border text-left text-xs font-semibold tracking-wider cursor-pointer transition-all ${
                          active
                            ? 'cm27-card-focus text-white'
                            : 'bg-[#0C0F14] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-condensed uppercase tracking-wider text-slate-400 mb-2">
                  Primary Format Focus
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['T20', 'ODI', 'Test'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFavoriteFormat(fmt)}
                      className={`py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider cursor-pointer ${
                        favoriteFormat === fmt
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-[#0C0F14] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-condensed uppercase tracking-wider text-slate-400 mb-2">
                  Manager Crest Accent
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setAvatarUrl(preset.url)}
                      className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${
                        avatarUrl === preset.url
                          ? 'cm27-card-focus'
                          : 'bg-[#0C0F14] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <ManagerBadge
                        name={displayPreview}
                        country={country}
                        accent={preset.url}
                        size="sm"
                      />
                      <span className="text-xs font-medium text-slate-200">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'CLUB' && (
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-[#0C0F14] border border-white/10 space-y-2">
                <p className="text-xs font-condensed uppercase tracking-widest text-amber-400">
                  NEXT STEP AFTER PROFILE CREATION
                </p>
                <h3 className="font-condensed text-2xl font-bold text-white uppercase">
                  CHOOSE YOUR LEAGUE COMPETITION
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Once you advance, you can create or join private multiplayer leagues tailored to a specific competition: Indian Premier League (T20), Big Bash League (T20), The Hundred (100-Ball), or International Cricket (T20, ODI &amp; Test).
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  'IPL (T20)',
                  'BBL (T20)',
                  'The Hundred (100B)',
                  'Internationals (Multi)',
                ].map((label) => (
                  <div
                    key={label}
                    className="p-2.5 rounded-lg bg-[#0C0F14] border border-white/10 text-center text-slate-200 font-medium"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'CONTRACT' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-[#93E6EE] text-xs font-condensed uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>READY FOR MANAGERIAL APPOINTMENT</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#0C0F14] border border-white/10">
                  <div className="text-slate-400">Display Name</div>
                  <div className="text-white font-semibold mt-1">{displayPreview}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0C0F14] border border-white/10">
                  <div className="text-slate-400">Nationality &amp; Currency</div>
                  <div className="text-white font-semibold mt-1 flex items-center gap-2">
                    <CountryFlag country={country} size="sm" />
                    <span>
                      {country} · {preferredCurrency}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#0C0F14] border border-white/10">
                  <div className="text-slate-400">Experience Tier</div>
                  <div className="text-[#93E6EE] font-semibold mt-1">{coachExperience}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0C0F14] border border-white/10">
                  <div className="text-slate-400">Philosophy</div>
                  <div className="text-amber-400 font-semibold mt-1">{coachingStyle}</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-5 mb-4 px-4 py-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Centered Advance Button */}
          <div className="py-5 px-5 border-t border-white/[0.06] flex items-center justify-center gap-4">
            {activeSubTab !== 'MANAGER' && (
              <button
                type="button"
                onClick={() => setActiveSubTab('MANAGER')}
                className="cm27-btn-dark-3d px-5 py-2 rounded text-xs font-semibold cursor-pointer"
              >
                Back to Details
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="cm27-btn-3d px-10 py-2.5 rounded font-bold text-sm tracking-wide cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving Profile...' : 'Advance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

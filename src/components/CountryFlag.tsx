import React from 'react';

export function CountryFlag({
  country,
  size = 'sm',
  className = '',
}: {
  country?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims =
    size === 'xs'
      ? 'w-4 h-3'
      : size === 'sm'
        ? 'w-5 h-3.5'
        : size === 'md'
          ? 'w-6 h-4'
          : 'w-8 h-5';

  const c = (country || 'India').trim();

  const renderSvg = () => {
    switch (c) {
      case 'India':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="8" fill="#FF9933" />
            <rect y="8" width="36" height="8" fill="#FFFFFF" />
            <rect y="16" width="36" height="8" fill="#138808" />
            <circle cx="18" cy="12" r="3" fill="none" stroke="#000080" strokeWidth="1.1" />
            <circle cx="18" cy="12" r="0.8" fill="#000080" />
          </svg>
        );
      case 'England':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#FFFFFF" />
            <rect x="15" width="6" height="24" fill="#CE1124" />
            <rect y="9" width="36" height="6" fill="#CE1124" />
          </svg>
        );
      case 'Australia':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#012169" />
            <rect width="16" height="11" fill="#012169" />
            <path d="M0 0 L16 11 M16 0 L0 11" stroke="#FFFFFF" strokeWidth="1.8" />
            <path d="M0 0 L16 11 M16 0 L0 11" stroke="#C8102E" strokeWidth="0.9" />
            <rect x="6.5" width="3" height="11" fill="#FFFFFF" />
            <rect y="4" width="16" height="3" fill="#FFFFFF" />
            <rect x="7.2" width="1.6" height="11" fill="#C8102E" />
            <rect y="4.7" width="16" height="1.6" fill="#C8102E" />
            <circle cx="8" cy="18" r="2" fill="#FFFFFF" />
            <circle cx="26" cy="7" r="1.3" fill="#FFFFFF" />
            <circle cx="29" cy="12" r="1.2" fill="#FFFFFF" />
            <circle cx="24" cy="14" r="1.1" fill="#FFFFFF" />
            <circle cx="27" cy="19" r="1.3" fill="#FFFFFF" />
          </svg>
        );
      case 'South Africa':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="12" fill="#E03C31" />
            <rect y="12" width="36" height="12" fill="#001489" />
            <path d="M0 0 L16 12 L0 24 Z" fill="#000000" />
            <path d="M0 3 L13 12 L0 21" fill="none" stroke="#FFB81C" strokeWidth="2" />
            <path d="M0 0 L15 10 H36 V14 H15 L0 24" fill="none" stroke="#FFFFFF" strokeWidth="5.5" />
            <path d="M0 0 L15 10 H36 V14 H15 L0 24" fill="none" stroke="#007749" strokeWidth="3.5" />
          </svg>
        );
      case 'New Zealand':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#00247D" />
            <path d="M0 0 L16 11 M16 0 L0 11" stroke="#FFFFFF" strokeWidth="1.6" />
            <rect x="6.5" width="3" height="11" fill="#FFFFFF" />
            <rect y="4" width="16" height="3" fill="#FFFFFF" />
            <rect x="7.2" width="1.6" height="11" fill="#CC142B" />
            <rect y="4.7" width="16" height="1.6" fill="#CC142B" />
            <circle cx="27" cy="6" r="1.5" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.6" />
            <circle cx="23" cy="12" r="1.4" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.6" />
            <circle cx="30" cy="11" r="1.4" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.6" />
            <circle cx="27" cy="18" r="1.6" fill="#CC142B" stroke="#FFFFFF" strokeWidth="0.6" />
          </svg>
        );
      case 'Pakistan':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#01411C" />
            <rect width="9" height="24" fill="#FFFFFF" />
            <circle cx="23" cy="12" r="5" fill="#FFFFFF" />
            <circle cx="24.5" cy="11" r="4.2" fill="#01411C" />
            <polygon points="26,8.5 26.8,10.5 29,10.5 27.2,11.8 27.8,13.8 26,12.5 24.2,13.8 24.8,11.8 23,10.5 25.2,10.5" fill="#FFFFFF" />
          </svg>
        );
      case 'Sri Lanka':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#FFBE29" />
            <rect x="2" y="2" width="6" height="20" fill="#00534E" />
            <rect x="8" y="2" width="6" height="20" fill="#EB7400" />
            <rect x="16" y="2.5" width="18" height="19" fill="#8D153A" />
            <circle cx="25" cy="12" r="4" fill="#FFBE29" />
          </svg>
        );
      case 'West Indies':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#7B1E3B" />
            <circle cx="18" cy="12" r="6" fill="none" stroke="#FACC15" strokeWidth="1.5" />
            <path d="M12 15 Q18 9 24 15" stroke="#22C55E" strokeWidth="1.6" fill="none" />
            <circle cx="18" cy="10" r="1.8" fill="#FACC15" />
          </svg>
        );
      case 'Bangladesh':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#006A4E" />
            <circle cx="16" cy="12" r="5.5" fill="#F42A41" />
          </svg>
        );
      case 'Afghanistan':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="12" height="24" fill="#111827" />
            <rect x="12" width="12" height="24" fill="#BE0027" />
            <rect x="24" width="12" height="24" fill="#009900" />
            <circle cx="18" cy="12" r="3" fill="none" stroke="#FDE047" strokeWidth="1.1" />
          </svg>
        );
      case 'Ireland':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="12" height="24" fill="#169B62" />
            <rect x="12" width="12" height="24" fill="#FFFFFF" />
            <rect x="24" width="12" height="24" fill="#FF883E" />
          </svg>
        );
      case 'Zimbabwe':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="3.5" fill="#006400" />
            <rect y="3.5" width="36" height="3.5" fill="#FFD200" />
            <rect y="7" width="36" height="3.5" fill="#D40000" />
            <rect y="10.5" width="36" height="3" fill="#111827" />
            <rect y="13.5" width="36" height="3.5" fill="#D40000" />
            <rect y="17" width="36" height="3.5" fill="#FFD200" />
            <rect y="20.5" width="36" height="3.5" fill="#006400" />
            <polygon points="0,0 14,12 0,24" fill="#FFFFFF" />
            <circle cx="4.5" cy="12" r="2.2" fill="#D40000" />
          </svg>
        );
      case 'Scotland':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#005EB8" />
            <path d="M0 0 L36 24 M36 0 L0 24" stroke="#FFFFFF" strokeWidth="4" />
          </svg>
        );
      case 'Netherlands':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="8" fill="#AE1C28" />
            <rect y="8" width="36" height="8" fill="#FFFFFF" />
            <rect y="16" width="36" height="8" fill="#21468B" />
          </svg>
        );
      case 'United Arab Emirates':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect x="9" width="27" height="8" fill="#00732F" />
            <rect x="9" y="8" width="27" height="8" fill="#FFFFFF" />
            <rect x="9" y="16" width="27" height="8" fill="#000000" />
            <rect width="9" height="24" fill="#FF0000" />
          </svg>
        );
      case 'United States':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#B22234" />
            <rect y="3.5" width="36" height="3" fill="#FFFFFF" />
            <rect y="9.5" width="36" height="3" fill="#FFFFFF" />
            <rect y="15.5" width="36" height="3" fill="#FFFFFF" />
            <rect width="16" height="13" fill="#3C3B6E" />
            <circle cx="5" cy="4.5" r="1" fill="#FFFFFF" />
            <circle cx="11" cy="4.5" r="1" fill="#FFFFFF" />
            <circle cx="8" cy="8.5" r="1" fill="#FFFFFF" />
          </svg>
        );
      case 'Nepal':
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#0F172A" />
            <polygon points="8,2 26,12 14,12 28,22 8,22" fill="#DC143C" stroke="#003893" strokeWidth="1.5" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 36 24" className="w-full h-full">
            <rect width="36" height="24" fill="#1E293B" />
            <circle cx="18" cy="12" r="5" fill="#22C55E" />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[3px] overflow-hidden border border-white/20 shrink-0 shadow-sm ${dims} ${className}`}
      title={c}
    >
      {renderSvg()}
    </span>
  );
}

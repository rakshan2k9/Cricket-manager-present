import React from 'react';

interface TeamCrestProps {
  templateKey?: string | null;
  shortCode: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 22,
  sm: 30,
  md: 42,
  lg: 68,
  xl: 112,
};

export const TeamCrest: React.FC<TeamCrestProps> = ({
  templateKey,
  shortCode,
  primaryColor = '#EAB308',
  secondaryColor = '#1E293B',
  size = 'sm',
  className = '',
}) => {
  const px = SIZE_MAP[size];
  const key = (templateKey || shortCode || 'HQ').toLowerCase();
  const uid = React.useId().replace(/:/g, '');

  // ============================================================================
  // 1. INDIAN PREMIER LEAGUE (10 Authentic Franchise Mascot & Emblem Crests)
  // ============================================================================

  if (key === 'csk') {
    // Chennai Super Kings: Crowned Roaring Golden Lion Emblem
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(250,204,21,0.35)] ${className}`}
        aria-label="Chennai Super Kings"
      >
        <defs>
          <radialGradient id={`csk-${uid}`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="55%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#CA8A04" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="29" fill="#1E3A8A" stroke="#FACC15" strokeWidth="2.5" />
        <circle cx="32" cy="32" r="25" fill={`url(#csk-${uid})`} fillOpacity="0.18" />
        {/* Crown */}
        <path
          d="M20 19 L23 11 L28 16 L32 9 L36 16 L41 11 L44 19 Z"
          fill="#FACC15"
          stroke="#0F172A"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Roaring Lion Mane & Head */}
        <path
          d="M17 28 C15 22 21 19 25 21 L32 19 L39 21 C43 19 49 22 47 28 C50 32 48 39 43 41 C42 46 37 49 32 50 C27 49 22 46 21 41 C16 39 14 32 17 28 Z"
          fill={`url(#csk-${uid})`}
          stroke="#0F172A"
          strokeWidth="1.5"
        />
        {/* Lion Facial Features & Roar */}
        <path d="M25 29 L28 31 M39 29 L36 31" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
        <path d="M29 35 L32 33 L35 35 L32 38 Z" fill="#1E3A8A" />
        <path d="M26 41 Q32 46 38 41 Q32 39 26 41 Z" fill="#991B1B" />
        {/* Bottom Banner */}
        <rect x="19" y="49" width="26" height="8" rx="3" fill="#1D4ED8" stroke="#FACC15" strokeWidth="1" />
        <text x="32" y="55" textAnchor="middle" fill="#FEF08A" fontSize="6.8" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          CSK
        </text>
      </svg>
    );
  }

  if (key === 'mi') {
    // Mumbai Indians: Spinning Gold & Cyan Sudarshan Chakra Wheel
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(0,75,160,0.45)] ${className}`}
        aria-label="Mumbai Indians"
      >
        <defs>
          <radialGradient id={`mi-${uid}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#003575" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="29" fill={`url(#mi-${uid})`} stroke="#D4AF37" strokeWidth="2.4" />
        {/* Chakra Rays (12 curved blades) */}
        {Array.from({ length: 12 }).map((_, i) => (
          <path
            key={i}
            d="M32 10 Q38 18 33 25 L31 25 Q33 17 32 10 Z"
            fill="#FACC15"
            transform={`rotate(${i * 30} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="14" fill="#004BA0" stroke="#FACC15" strokeWidth="2" />
        <circle cx="32" cy="32" r="10.5" fill="none" stroke="#38BDF8" strokeWidth="1.2" strokeDasharray="3 2" />
        <text x="32" y="36" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          MI
        </text>
      </svg>
    );
  }

  if (key === 'rcb') {
    // Royal Challengers Bengaluru: Crowned Rampant Gold Lion on Crimson/Black Shield
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(220,38,38,0.45)] ${className}`}
        aria-label="Royal Challengers Bengaluru"
      >
        <path
          d="M11 11 L32 5 L53 11 V33 C53 46 43 55 32 60 C21 55 11 46 11 33 Z"
          fill="#111827"
          stroke="#FACC15"
          strokeWidth="2.2"
        />
        <path
          d="M15 15 L32 10 L49 15 V32 C49 43 41 50 32 55 C23 50 15 43 15 32 Z"
          fill="#B91C1C"
        />
        {/* Crown */}
        <path d="M23 15 L26 9 L32 13 L38 9 L41 15 Z" fill="#FACC15" />
        {/* Rampant Lion Silhouette */}
        <path
          d="M27 45 C25 40 28 34 26 30 C23 28 22 24 26 21 C28 19 33 19 35 22 C39 20 42 23 39 27 C43 29 42 35 37 37 C39 41 37 45 35 48 L31 48 L32 42 L29 47 Z"
          fill="#FACC15"
          stroke="#111827"
          strokeWidth="1"
        />
        <text x="32" y="54" textAnchor="middle" fill="#FEF08A" fontSize="7" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          RCB
        </text>
      </svg>
    );
  }

  if (key === 'kkr') {
    // Kolkata Knight Riders: Plumed Knight Spartan Helmet & Crossed Blades
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(126,34,206,0.45)] ${className}`}
        aria-label="Kolkata Knight Riders"
      >
        <path
          d="M11 12 L32 5 L53 12 V33 C53 46 42 55 32 59 C22 55 11 46 11 33 Z"
          fill="#3B0764"
          stroke="#FACC15"
          strokeWidth="2.2"
        />
        {/* Crossed Golden Blades */}
        <path d="M18 46 L46 18 M46 46 L18 18" stroke="#FACC15" strokeWidth="2.2" strokeOpacity="0.45" strokeLinecap="round" />
        {/* Knight Crest Plume */}
        <path d="M24 14 C28 9 36 9 40 14 L38 19 H26 Z" fill="#FACC15" />
        {/* Knight Visor Helmet */}
        <path
          d="M21 20 H43 V35 C43 43 32 48 32 48 C32 48 21 43 21 35 Z"
          fill="#1E1B4B"
          stroke="#FACC15"
          strokeWidth="1.8"
        />
        {/* Visor T-Slit */}
        <path d="M24 27 H40 M32 27 V42" stroke="#FACC15" strokeWidth="2.8" strokeLinecap="round" />
        <text x="32" y="55" textAnchor="middle" fill="#FDE047" fontSize="7" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          KKR
        </text>
      </svg>
    );
  }

  if (key === 'srh') {
    // Sunrisers Hyderabad: Fiery Rising Sun & Phoenix Wings
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(234,88,12,0.45)] ${className}`}
        aria-label="Sunrisers Hyderabad"
      >
        <circle cx="32" cy="32" r="29" fill="#111827" stroke="#F97316" strokeWidth="2.4" />
        {/* Rising Sun */}
        <circle cx="32" cy="30" r="14" fill="#F97316" />
        <circle cx="32" cy="30" r="9.5" fill="#FACC15" />
        {/* Eagle / Phoenix Wings */}
        <path
          d="M8 29 Q18 22 25 32 Q19 36 10 38 Z"
          fill="#EA580C"
          stroke="#FEF08A"
          strokeWidth="1"
        />
        <path
          d="M56 29 Q46 22 39 32 Q45 36 54 38 Z"
          fill="#EA580C"
          stroke="#FEF08A"
          strokeWidth="1"
        />
        {/* Bird Head Silhouette */}
        <path d="M29 31 L32 22 L35 31 L32 36 Z" fill="#111827" />
        <rect x="19" y="44" width="26" height="9" rx="3" fill="#EA580C" stroke="#FACC15" strokeWidth="1" />
        <text x="32" y="51" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          SRH
        </text>
      </svg>
    );
  }

  if (key === 'rr') {
    // Rajasthan Royals: Royal Jaipur Crown & Crossed Sabers on Pink/Blue
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(219,39,119,0.45)] ${className}`}
        aria-label="Rajasthan Royals"
      >
        <path
          d="M11 12 L32 5 L53 12 V33 C53 46 43 55 32 59 C21 55 11 46 11 33 Z"
          fill="#BE185D"
          stroke="#FACC15"
          strokeWidth="2.2"
        />
        <path
          d="M15 15 L32 10 L49 15 V32 C49 42 41 49 32 54 C23 49 15 42 15 32 Z"
          fill="#1E3A8A"
          fillOpacity="0.82"
        />
        {/* Royal Crown */}
        <path
          d="M18 33 L20 20 L27 26 L32 16 L37 26 L44 20 L46 33 Z"
          fill="#FACC15"
          stroke="#F472B6"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <rect x="19" y="34" width="26" height="3.5" rx="1.5" fill="#EC4899" />
        <circle cx="32" cy="14" r="2" fill="#F472B6" />
        <text x="32" y="48" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          RR
        </text>
      </svg>
    );
  }

  if (key === 'dc') {
    // Delhi Capitals: Twin Tigers Flanking Central Star Emblem
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(37,99,235,0.45)] ${className}`}
        aria-label="Delhi Capitals"
      >
        <circle cx="32" cy="32" r="29" fill="#1D4ED8" stroke="#EF4444" strokeWidth="2.4" />
        <path d="M10 32 A22 22 0 0 1 54 32 Z" fill="#1E3A8A" />
        <path d="M10 32 A22 22 0 0 0 54 32 Z" fill="#B91C1C" />
        {/* Twin Tiger Silhouettes */}
        <path d="M12 24 C17 20 23 22 24 29 L20 35 L13 31 Z" fill="#F8FAFC" fillOpacity="0.92" />
        <path d="M52 24 C47 20 41 22 40 29 L44 35 L51 31 Z" fill="#F8FAFC" fillOpacity="0.92" />
        {/* Central Shield Star */}
        <circle cx="32" cy="32" r="12" fill="#0F172A" stroke="#FACC15" strokeWidth="1.8" />
        <text x="32" y="36" textAnchor="middle" fill="#FFFFFF" fontSize="11.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          DC
        </text>
      </svg>
    );
  }

  if (key === 'pbks') {
    // Punjab Kings: Gold Lion Emblem on Crimson Hex Shield
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(220,38,38,0.45)] ${className}`}
        aria-label="Punjab Kings"
      >
        <polygon
          points="32,4 54,15 54,42 32,59 10,42 10,15"
          fill="#DC2626"
          stroke="#FACC15"
          strokeWidth="2.4"
        />
        <polygon points="32,9 49,18 49,40 32,54 15,40 15,18" fill="#7F1D1D" />
        {/* Crown + Lion Emblem */}
        <path d="M23 19 L27 13 L32 17 L37 13 L41 19 Z" fill="#FACC15" />
        <circle cx="32" cy="29" r="9.5" fill="#FACC15" stroke="#7F1D1D" strokeWidth="1.4" />
        <path d="M28 27 L30 29 M36 27 L34 29 M29 33 Q32 36 35 33" stroke="#7F1D1D" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <text x="32" y="49" textAnchor="middle" fill="#FEF08A" fontSize="8.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          PBKS
        </text>
      </svg>
    );
  }

  if (key === 'gt') {
    // Gujarat Titans: Winged Kite-Diamond Titan Lightning Crest
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(234,179,8,0.35)] ${className}`}
        aria-label="Gujarat Titans"
      >
        <path d="M32 4 L56 26 L32 60 L8 26 Z" fill="#0F172A" stroke="#EAB308" strokeWidth="2.4" />
        <path d="M32 10 L50 26 L32 53 L14 26 Z" fill="#1E293B" stroke="#38BDF8" strokeWidth="1" />
        {/* Lightning Bolt */}
        <path d="M35 13 L25 31 H33 L29 45 L41 26 H33 Z" fill="#FACC15" />
        <rect x="20" y="45" width="24" height="8" rx="3" fill="#0F172A" stroke="#EAB308" strokeWidth="1" />
        <text x="32" y="51.5" textAnchor="middle" fill="#FFFFFF" fontSize="7.2" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          GT
        </text>
      </svg>
    );
  }

  if (key === 'lsg') {
    // Lucknow Super Giants: Tricolor Winged Garuda Crest
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_8px_rgba(14,165,233,0.4)] ${className}`}
        aria-label="Lucknow Super Giants"
      >
        <circle cx="32" cy="32" r="29" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="2.2" />
        {/* Left & Right Tricolor Garuda Wings */}
        <path d="M8 22 L24 27 L20 33 L9 30 Z" fill="#F97316" />
        <path d="M9 32 L22 34 L19 39 L12 38 Z" fill="#22C55E" />
        <path d="M56 22 L40 27 L44 33 L55 30 Z" fill="#F97316" />
        <path d="M55 32 L42 34 L45 39 L52 38 Z" fill="#22C55E" />
        {/* Central Shield */}
        <path d="M22 16 H42 V36 C42 44 32 50 32 50 C32 50 22 44 22 36 Z" fill="#0EA5E9" stroke="#F8FAFC" strokeWidth="1.6" />
        <text x="32" y="37" textAnchor="middle" fill="#FFFFFF" fontSize="10.5" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          LSG
        </text>
      </svg>
    );
  }

  // ============================================================================
  // 2. INTERNATIONAL FULL MEMBERS (10 National Flag & Cricket Board Crests)
  // ============================================================================

  if (['ind', 'aus', 'eng', 'sa', 'nz', 'pak', 'sl', 'wi', 'ban', 'afg'].includes(key)) {
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className={`shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] ${className}`}
        aria-label={shortCode}
      >
        <defs>
          <clipPath id={`clip-nat-${uid}`}>
            <circle cx="32" cy="32" r="28" />
          </clipPath>
        </defs>
        <circle cx="32" cy="32" r="29.5" fill="#0D1014" stroke={primaryColor} strokeWidth="2.4" />
        <g clipPath={`url(#clip-nat-${uid})`}>
          {key === 'ind' && (
            <>
              <rect y="0" width="64" height="21" fill="#FF9933" />
              <rect y="21" width="64" height="22" fill="#FFFFFF" />
              <rect y="43" width="64" height="21" fill="#138808" />
              <circle cx="32" cy="32" r="8.5" fill="none" stroke="#1D4ED8" strokeWidth="2" />
              <circle cx="32" cy="32" r="2.2" fill="#1D4ED8" />
            </>
          )}
          {key === 'eng' && (
            <>
              <rect width="64" height="64" fill="#F8FAFC" />
              <rect x="26" y="0" width="12" height="64" fill="#DC2626" />
              <rect x="0" y="26" width="64" height="12" fill="#DC2626" />
            </>
          )}
          {key === 'aus' && (
            <>
              <rect width="64" height="64" fill="#064E3B" />
              <circle cx="32" cy="32" r="22" fill="none" stroke="#FACC15" strokeWidth="2" />
              <polygon points="32,12 34,18 40,18 35,22 37,28 32,24 27,28 29,22 24,18 30,18" fill="#FACC15" />
              <circle cx="20" cy="40" r="2.2" fill="#FFFFFF" />
              <circle cx="44" cy="40" r="2.2" fill="#FFFFFF" />
              <circle cx="32" cy="48" r="2.5" fill="#FFFFFF" />
            </>
          )}
          {key === 'sa' && (
            <>
              <rect y="0" width="64" height="22" fill="#DC2626" />
              <rect y="42" width="64" height="22" fill="#1D4ED8" />
              <rect y="22" width="64" height="20" fill="#FFFFFF" />
              <path d="M0 6 L34 32 L0 58 Z" fill="#111827" />
              <path d="M0 16 L24 32 L0 48 Z" fill="#FACC15" />
              <path d="M0 24 H64 V40 H0 Z" fill="#15803D" fillOpacity="0.9" />
            </>
          )}
          {key === 'nz' && (
            <>
              <rect width="64" height="64" fill="#090D12" />
              <path d="M18 48 Q28 30 46 14" stroke="#F8FAFC" strokeWidth="2.5" fill="none" />
              {[0, 1, 2, 3, 4].map((i) => (
                <path
                  key={i}
                  d={`M${22 + i * 5} ${42 - i * 6} L${15 + i * 5} ${36 - i * 6} M${22 + i * 5} ${42 - i * 6} L${30 + i * 5} ${44 - i * 6}`}
                  stroke="#E2E8F0"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ))}
            </>
          )}
          {key === 'pak' && (
            <>
              <rect width="64" height="64" fill="#065F46" />
              <rect width="16" height="64" fill="#F8FAFC" />
              <circle cx="39" cy="32" r="13" fill="#F8FAFC" />
              <circle cx="43" cy="29" r="11" fill="#065F46" />
              <polygon points="43,23 44.5,27 48.5,27 45.2,29.5 46.5,33.5 43,31 39.5,33.5 40.8,29.5 37.5,27 41.5,27" fill="#F8FAFC" />
            </>
          )}
          {key === 'sl' && (
            <>
              <rect width="64" height="64" fill="#1E3A8A" />
              <rect x="6" y="14" width="52" height="36" fill="#7F1D1D" stroke="#FACC15" strokeWidth="2" />
              <circle cx="32" cy="32" r="9" fill="#FACC15" />
            </>
          )}
          {key === 'wi' && (
            <>
              <rect width="64" height="64" fill="#7F1D1D" />
              <circle cx="32" cy="40" r="16" fill="#FACC15" fillOpacity="0.22" />
              <path d="M25 22 V44 M32 20 V44 M39 22 V44 M24 22 H40" stroke="#FACC15" strokeWidth="2.4" strokeLinecap="round" />
            </>
          )}
          {key === 'ban' && (
            <>
              <rect width="64" height="64" fill="#065F46" />
              <circle cx="30" cy="32" r="14" fill="#EF4444" />
            </>
          )}
          {key === 'afg' && (
            <>
              <rect x="0" width="21" height="64" fill="#111827" />
              <rect x="21" width="22" height="64" fill="#DC2626" />
              <rect x="43" width="21" height="64" fill="#15803D" />
              <circle cx="32" cy="32" r="8" fill="#F8FAFC" fillOpacity="0.9" />
            </>
          )}
        </g>
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" />
        <rect x="17" y="46" width="30" height="10" rx="4" fill="#090D12" fillOpacity="0.88" stroke={primaryColor} strokeWidth="1" />
        <text x="32" y="53.5" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900" fontFamily="Barlow Condensed, sans-serif">
          {shortCode}
        </text>
      </svg>
    );
  }

  // ============================================================================
  // 3. BBL & THE HUNDRED FRANCHISES (Custom Distinct Club Badges)
  // ============================================================================
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      className={`shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] ${className}`}
      aria-label={shortCode}
    >
      <defs>
        <linearGradient id={`sh-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>
      </defs>
      <path
        d="M10 10 L32 4 L54 10 V31 C54 45 43 55 32 60 C21 55 10 45 10 31 Z"
        fill={`url(#sh-${uid})`}
        stroke="#F8FAFC"
        strokeOpacity="0.45"
        strokeWidth="2"
      />
      <path
        d="M15 14 L32 9 L49 14 V30 C49 41 40 49 32 54 C24 49 15 41 15 30 Z"
        fill="#0B0F14"
        fillOpacity="0.65"
        stroke={primaryColor}
        strokeWidth="1.2"
      />
      {/* Distinct symbol per BBL / Hundred club */}
      {(key === 'sco' || key === 'bp' || key === 'wf') && (
        // Fiery Flame Motif
        <path d="M32 13 C36 18 38 22 35 26 C39 24 41 28 38 32 C35 35 29 35 26 31 C24 27 28 21 32 13 Z" fill={primaryColor} />
      )}
      {(key === 'hea' || key === 'thu' || key === 'ns' || key === 'str') && (
        // Electric Bolt Motif
        <path d="M34 12 L26 24 H32 L29 34 L39 21 H33 Z" fill={primaryColor} />
      )}
      {(key === 'sta' || key === 'six' || key === 'sb' || key === 'oi') && (
        // 5-Point Star Motif
        <polygon points="32,12 34.5,19 41.5,19 36,23.5 38,30.5 32,26 26,30.5 28,23.5 22.5,19 29.5,19" fill={primaryColor} />
      )}
      {(key === 'hur' || key === 'ren' || key === 'tr' || key === 'mo' || key === 'ls') && (
        // Rocket / Cyclone Crest Motif
        <path d="M32 12 L38 25 L32 22 L26 25 Z M27 27 H37" stroke={primaryColor} strokeWidth="2" fill={primaryColor} strokeLinecap="round" />
      )}
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={shortCode.length >= 4 ? '12' : '14'}
        fontWeight="900"
        letterSpacing="0.5"
        fontFamily="Barlow Condensed, sans-serif"
      >
        {shortCode.slice(0, 4)}
      </text>
    </svg>
  );
};

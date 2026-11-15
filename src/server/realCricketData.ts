export type LeagueCategory =
  | 'IPL'
  | 'PSL'
  | 'SA20'
  | 'BBL'
  | 'The Hundred'
  | 'International';

export interface FranchiseCatalogEntry {
  templateKey: string;
  name: string;
  shortCode: string;
  leagueCategory: LeagueCategory;
  homeGround: string;
  foundedYear: number;
  boardValue: number; // In Lakhs
  fanbaseDevotion: 'LEGENDARY' | 'VERY HIGH' | 'HIGH' | 'GROWING';
  youthFacilities: 'ELITE' | 'VERY HIGH' | 'HIGH' | 'DEVELOPING';
  primaryColor: string;
  secondaryColor: string;
  coachName: string;
  coachingSpecialty: string;
  reputation: number;
  trophiesCount: number;
  historicalTitles: string[];
  batPreview: number;
  bowlPreview: number;
  fieldPreview: number;
  trophyBreakdown: { label: string; count: number }[];
}

export interface CoachCatalogEntry {
  id: string;
  name: string;
  country: string;
  role: 'Head Coach' | 'Batting Coach' | 'Bowling Coach' | 'Fielding Coach' | 'Wicketkeeping Coach';
  knowledge: 'Expert' | 'Accomplished' | 'Competent' | 'Novice';
  batStars: number;
  bowlStars: number;
  fieldStars: number;
  wkStars: number;
  signingFeeLakhs: number;
  weeklyWageLakhs: number;
  legacyNote: string;
}

export interface ScoutCatalogEntry {
  id: string;
  name: string;
  country: string;
  experienceStars: number;
  judgementStars: number;
  networkCostLakhs: number;
  specialtyRegion: string;
}

export const LEAGUE_CATEGORIES: { id: LeagueCategory; label: string; subtitle: string }[] = [
  { id: 'IPL', label: 'Indian Premier League', subtitle: '10 T20 Franchises' },
  { id: 'PSL', label: 'Pakistan Super League', subtitle: '6 T20 Franchises' },
  { id: 'SA20', label: 'SA20', subtitle: '6 South African Franchises' },
  { id: 'BBL', label: 'Big Bash League', subtitle: '8 Australian T20 Clubs' },
  { id: 'The Hundred', label: 'The Hundred', subtitle: '8 ECB 100-Ball Franchises' },
  { id: 'International', label: 'International', subtitle: '10 Full Member Nations' },
];

export const FRANCHISE_CATALOG: FranchiseCatalogEntry[] = [
  // 1. IPL (10 Franchises)
  {
    templateKey: 'csk',
    name: 'Chennai Super Kings',
    shortCode: 'CSK',
    leagueCategory: 'IPL',
    homeGround: 'M. A. Chidambaram Stadium, Chennai',
    foundedYear: 2008,
    boardValue: 215000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#FACC15',
    secondaryColor: '#1D4ED8',
    coachName: 'Stephen Fleming',
    coachingSpecialty: 'Spin & Tactical Finishing',
    reputation: 96,
    trophiesCount: 5,
    historicalTitles: ['2010', '2011', '2018', '2021', '2023'],
    batPreview: 91,
    bowlPreview: 88,
    fieldPreview: 89,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 5 },
      { label: 'CLT20', count: 2 },
      { label: 'Playoff Apps', count: 12 },
      { label: 'Fair Play', count: 6 },
    ],
  },
  {
    templateKey: 'mi',
    name: 'Mumbai Indians',
    shortCode: 'MI',
    leagueCategory: 'IPL',
    homeGround: 'Wankhede Stadium, Mumbai',
    foundedYear: 2008,
    boardValue: 230000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'ELITE',
    primaryColor: '#004BA0',
    secondaryColor: '#D4AF37',
    coachName: 'Mahela Jayawardene',
    coachingSpecialty: 'Pace Scouting & Depth',
    reputation: 96,
    trophiesCount: 5,
    historicalTitles: ['2013', '2015', '2017', '2019', '2020'],
    batPreview: 92,
    bowlPreview: 90,
    fieldPreview: 87,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 5 },
      { label: 'CLT20', count: 2 },
      { label: 'Playoff Apps', count: 10 },
      { label: 'Scouting Wins', count: 14 },
    ],
  },
  {
    templateKey: 'rcb',
    name: 'Royal Challengers Bengaluru',
    shortCode: 'RCB',
    leagueCategory: 'IPL',
    homeGround: 'M. Chinnaswamy Stadium, Bengaluru',
    foundedYear: 2008,
    boardValue: 205000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'HIGH',
    primaryColor: '#D91B24',
    secondaryColor: '#D4AF37',
    coachName: 'Andy Flower',
    coachingSpecialty: 'Powerplay Aggression',
    reputation: 91,
    trophiesCount: 1,
    historicalTitles: ['2025'],
    batPreview: 93,
    bowlPreview: 84,
    fieldPreview: 86,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 1 },
      { label: 'Finals', count: 4 },
      { label: 'Playoff Apps', count: 10 },
      { label: 'WPL Titles', count: 1 },
    ],
  },
  {
    templateKey: 'kkr',
    name: 'Kolkata Knight Riders',
    shortCode: 'KKR',
    leagueCategory: 'IPL',
    homeGround: 'Eden Gardens, Kolkata',
    foundedYear: 2008,
    boardValue: 198000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#5B2C83',
    secondaryColor: '#F2C94C',
    coachName: 'Chandrakant Pandit',
    coachingSpecialty: 'Mystery Spin & Flexibility',
    reputation: 92,
    trophiesCount: 3,
    historicalTitles: ['2012', '2014', '2024'],
    batPreview: 90,
    bowlPreview: 89,
    fieldPreview: 88,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 3 },
      { label: 'Finals', count: 4 },
      { label: 'Playoff Apps', count: 8 },
      { label: 'CLT20 Finals', count: 1 },
    ],
  },
  {
    templateKey: 'srh',
    name: 'Sunrisers Hyderabad',
    shortCode: 'SRH',
    leagueCategory: 'IPL',
    homeGround: 'Rajiv Gandhi Intl. Stadium, Hyderabad',
    foundedYear: 2013,
    boardValue: 162000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#F26522',
    secondaryColor: '#111827',
    coachName: 'Daniel Vettori',
    coachingSpecialty: 'High-Tempo Batting & Death Bowling',
    reputation: 87,
    trophiesCount: 1,
    historicalTitles: ['2016'],
    batPreview: 91,
    bowlPreview: 86,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 1 },
      { label: 'Finals', count: 3 },
      { label: 'Playoff Apps', count: 7 },
      { label: 'Fair Play', count: 2 },
    ],
  },
  {
    templateKey: 'rr',
    name: 'Rajasthan Royals',
    shortCode: 'RR',
    leagueCategory: 'IPL',
    homeGround: 'Sawai Mansingh Stadium, Jaipur',
    foundedYear: 2008,
    boardValue: 158000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'ELITE',
    primaryColor: '#EA1A85',
    secondaryColor: '#1D4ED8',
    coachName: 'Rahul Dravid',
    coachingSpecialty: 'Youth Development & Moneyball',
    reputation: 86,
    trophiesCount: 1,
    historicalTitles: ['2008'],
    batPreview: 89,
    bowlPreview: 85,
    fieldPreview: 86,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 1 },
      { label: 'Finals', count: 2 },
      { label: 'Playoff Apps', count: 6 },
      { label: 'Academy Grads', count: 11 },
    ],
  },
  {
    templateKey: 'dc',
    name: 'Delhi Capitals',
    shortCode: 'DC',
    leagueCategory: 'IPL',
    homeGround: 'Arun Jaitley Stadium, New Delhi',
    foundedYear: 2008,
    boardValue: 165000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#004C93',
    secondaryColor: '#EF1B23',
    coachName: 'Hemang Badani',
    coachingSpecialty: 'Domestic Core & Fielding',
    reputation: 84,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 87,
    bowlPreview: 85,
    fieldPreview: 86,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 0 },
      { label: 'Finals', count: 1 },
      { label: 'Playoff Apps', count: 6 },
      { label: 'Top 2 Finishes', count: 3 },
    ],
  },
  {
    templateKey: 'pbks',
    name: 'Punjab Kings',
    shortCode: 'PBKS',
    leagueCategory: 'IPL',
    homeGround: 'PCA New Stadium, Mullanpur',
    foundedYear: 2008,
    boardValue: 145000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#DD1F2D',
    secondaryColor: '#E2E8F0',
    coachName: 'Ricky Ponting',
    coachingSpecialty: 'Middle-Over Strike Power',
    reputation: 82,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 87,
    bowlPreview: 83,
    fieldPreview: 84,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 0 },
      { label: 'Finals', count: 2 },
      { label: 'Playoff Apps', count: 3 },
      { label: 'Highest Chase', count: 1 },
    ],
  },
  {
    templateKey: 'gt',
    name: 'Gujarat Titans',
    shortCode: 'GT',
    leagueCategory: 'IPL',
    homeGround: 'Narendra Modi Stadium, Ahmedabad',
    foundedYear: 2022,
    boardValue: 175000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#1B2133',
    secondaryColor: '#D4AF37',
    coachName: 'Ashish Nehra',
    coachingSpecialty: 'Disciplined Bowling & Chase Control',
    reputation: 89,
    trophiesCount: 1,
    historicalTitles: ['2022'],
    batPreview: 89,
    bowlPreview: 88,
    fieldPreview: 87,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 1 },
      { label: 'Finals', count: 2 },
      { label: 'Playoff Apps', count: 3 },
      { label: 'Top Finish', count: 2 },
    ],
  },
  {
    templateKey: 'lsg',
    name: 'Lucknow Super Giants',
    shortCode: 'LSG',
    leagueCategory: 'IPL',
    homeGround: 'BRSABV Ekana Stadium, Lucknow',
    foundedYear: 2022,
    boardValue: 155000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#0057E2',
    secondaryColor: '#F97316',
    coachName: 'Justin Langer',
    coachingSpecialty: 'All-Rounder Matchups',
    reputation: 84,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 87,
    bowlPreview: 84,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'IPL Titles', count: 0 },
      { label: 'Finals', count: 0 },
      { label: 'Playoff Apps', count: 2 },
      { label: 'Pace Depth', count: 5 },
    ],
  },

  // 2. International Full Members (10 Teams)
  {
    templateKey: 'ind',
    name: 'India',
    shortCode: 'IND',
    leagueCategory: 'International',
    homeGround: 'Wankhede Stadium / Eden Gardens',
    foundedYear: 1928,
    boardValue: 485000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'ELITE',
    primaryColor: '#2563EB',
    secondaryColor: '#F97316',
    coachName: 'Gautam Gambhir',
    coachingSpecialty: 'All-Format Dominance',
    reputation: 98,
    trophiesCount: 7,
    historicalTitles: ['1983', '2007', '2011', '2013', '2024', '2025'],
    batPreview: 95,
    bowlPreview: 93,
    fieldPreview: 90,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 2 },
      { label: 'T20 World Cup', count: 2 },
      { label: 'Champions Trophy', count: 3 },
      { label: 'WTC Finals', count: 2 },
    ],
  },
  {
    templateKey: 'aus',
    name: 'Australia',
    shortCode: 'AUS',
    leagueCategory: 'International',
    homeGround: 'Melbourne Cricket Ground',
    foundedYear: 1877,
    boardValue: 263010,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#EAB308',
    secondaryColor: '#15803D',
    coachName: 'Andrew McDonald',
    coachingSpecialty: 'Big-Tournament Execution',
    reputation: 97,
    trophiesCount: 10,
    historicalTitles: ['1987', '1999', '2003', '2007', '2015', '2021', '2023'],
    batPreview: 92,
    bowlPreview: 93,
    fieldPreview: 92,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 6 },
      { label: 'T20 World Cup', count: 1 },
      { label: 'Champions Trophy', count: 2 },
      { label: 'WTC / Test', count: 1 },
    ],
  },
  {
    templateKey: 'eng',
    name: 'England',
    shortCode: 'ENG',
    leagueCategory: 'International',
    homeGround: "Lord's Cricket Ground, London",
    foundedYear: 1877,
    boardValue: 295000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'ELITE',
    primaryColor: '#1D4ED8',
    secondaryColor: '#DC2626',
    coachName: 'Brendon McCullum',
    coachingSpecialty: 'Aggressive White & Red Ball',
    reputation: 93,
    trophiesCount: 3,
    historicalTitles: ['2010', '2019', '2022'],
    batPreview: 91,
    bowlPreview: 88,
    fieldPreview: 89,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 1 },
      { label: 'T20 World Cup', count: 2 },
      { label: 'Champions Trophy', count: 0 },
      { label: 'Ashes Series', count: 32 },
    ],
  },
  {
    templateKey: 'sa',
    name: 'South Africa',
    shortCode: 'SA',
    leagueCategory: 'International',
    homeGround: 'Newlands / Wanderers, Johannesburg',
    foundedYear: 1889,
    boardValue: 184000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#16A34A',
    secondaryColor: '#EAB308',
    coachName: 'Shukri Conrad',
    coachingSpecialty: 'Pace Attack & Athleticism',
    reputation: 90,
    trophiesCount: 2,
    historicalTitles: ['1998', '2025'],
    batPreview: 89,
    bowlPreview: 91,
    fieldPreview: 93,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 0 },
      { label: 'T20 World Cup', count: 0 },
      { label: 'Champions Trophy', count: 1 },
      { label: 'WTC / Test', count: 1 },
    ],
  },
  {
    templateKey: 'nz',
    name: 'New Zealand',
    shortCode: 'NZ',
    leagueCategory: 'International',
    homeGround: 'Eden Park, Auckland',
    foundedYear: 1930,
    boardValue: 148000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#334155',
    secondaryColor: '#94A3B8',
    coachName: 'Gary Stead',
    coachingSpecialty: 'Tactical Preparation & Swing',
    reputation: 90,
    trophiesCount: 2,
    historicalTitles: ['2000', '2021'],
    batPreview: 88,
    bowlPreview: 89,
    fieldPreview: 92,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 0 },
      { label: 'T20 World Cup', count: 0 },
      { label: 'Champions Trophy', count: 1 },
      { label: 'WTC / Test', count: 1 },
    ],
  },
  {
    templateKey: 'pak',
    name: 'Pakistan',
    shortCode: 'PAK',
    leagueCategory: 'International',
    homeGround: 'Gaddafi Stadium, Lahore',
    foundedYear: 1952,
    boardValue: 175000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'HIGH',
    primaryColor: '#15803D',
    secondaryColor: '#FACC15',
    coachName: 'Aaqib Javed',
    coachingSpecialty: 'Raw Express Pace & Wrist Spin',
    reputation: 88,
    trophiesCount: 3,
    historicalTitles: ['1992', '2009', '2017'],
    batPreview: 86,
    bowlPreview: 90,
    fieldPreview: 81,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 1 },
      { label: 'T20 World Cup', count: 1 },
      { label: 'Champions Trophy', count: 1 },
      { label: 'Test Maces', count: 1 },
    ],
  },
  {
    templateKey: 'sl',
    name: 'Sri Lanka',
    shortCode: 'SL',
    leagueCategory: 'International',
    homeGround: 'R. Premadasa Stadium, Colombo',
    foundedYear: 1981,
    boardValue: 118000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#1E40AF',
    secondaryColor: '#FACC15',
    coachName: 'Sanath Jayasuriya',
    coachingSpecialty: 'Spin Subcontinent Craft',
    reputation: 84,
    trophiesCount: 3,
    historicalTitles: ['1996', '2002', '2014'],
    batPreview: 84,
    bowlPreview: 86,
    fieldPreview: 84,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 1 },
      { label: 'T20 World Cup', count: 1 },
      { label: 'Champions Trophy', count: 1 },
      { label: 'Asia Cup', count: 6 },
    ],
  },
  {
    templateKey: 'wi',
    name: 'West Indies',
    shortCode: 'WI',
    leagueCategory: 'International',
    homeGround: 'Kensington Oval, Barbados',
    foundedYear: 1928,
    boardValue: 122000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#881337',
    secondaryColor: '#F59E0B',
    coachName: 'Daren Sammy',
    coachingSpecialty: 'Six-Hitting & T20 Flair',
    reputation: 85,
    trophiesCount: 5,
    historicalTitles: ['1975', '1979', '2004', '2012', '2016'],
    batPreview: 88,
    bowlPreview: 84,
    fieldPreview: 86,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 2 },
      { label: 'T20 World Cup', count: 2 },
      { label: 'Champions Trophy', count: 1 },
      { label: 'WTC / Test', count: 0 },
    ],
  },
  {
    templateKey: 'ban',
    name: 'Bangladesh',
    shortCode: 'BAN',
    leagueCategory: 'International',
    homeGround: 'Shere Bangla National Stadium, Dhaka',
    foundedYear: 2000,
    boardValue: 110000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#047857',
    secondaryColor: '#DC2626',
    coachName: 'Phil Simmons',
    coachingSpecialty: 'Home Spin & Left-Arm Craft',
    reputation: 80,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 81,
    bowlPreview: 83,
    fieldPreview: 82,
    trophyBreakdown: [
      { label: 'ODI World Cup', count: 0 },
      { label: 'T20 World Cup', count: 0 },
      { label: 'U19 World Cup', count: 1 },
      { label: 'Asia Cup Finals', count: 3 },
    ],
  },
  {
    templateKey: 'afg',
    name: 'Afghanistan',
    shortCode: 'AFG',
    leagueCategory: 'International',
    homeGround: 'Greater Noida / Sharjah Intl.',
    foundedYear: 2017,
    boardValue: 82000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'DEVELOPING',
    primaryColor: '#0EA5E9',
    secondaryColor: '#DC2626',
    coachName: 'Jonathan Trott',
    coachingSpecialty: 'Spin Chokehold & Grit',
    reputation: 84,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 82,
    bowlPreview: 89,
    fieldPreview: 83,
    trophyBreakdown: [
      { label: 'T20 WC Semis', count: 1 },
      { label: 'ODI WC Wins', count: 5 },
      { label: 'Test Wins', count: 3 },
      { label: 'Rise Tier', count: 1 },
    ],
  },

  // 3. Big Bash League (All 8 Franchises)
  {
    templateKey: 'six',
    name: 'Sydney Sixers',
    shortCode: 'SIX',
    leagueCategory: 'BBL',
    homeGround: 'Sydney Cricket Ground (SCG)',
    foundedYear: 2011,
    boardValue: 115000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#EC4899',
    secondaryColor: '#1E293B',
    coachName: 'Greg Shipperd',
    coachingSpecialty: 'Consistency & Finishes',
    reputation: 89,
    trophiesCount: 3,
    historicalTitles: ['2011-12', '2019-20', '2020-21'],
    batPreview: 87,
    bowlPreview: 87,
    fieldPreview: 88,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 3 },
      { label: 'CLT20', count: 1 },
      { label: 'BBL Finals', count: 7 },
      { label: 'Playoff Apps', count: 10 },
    ],
  },
  {
    templateKey: 'sco',
    name: 'Perth Scorchers',
    shortCode: 'SCO',
    leagueCategory: 'BBL',
    homeGround: 'Optus Stadium, Perth',
    foundedYear: 2011,
    boardValue: 122000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'ELITE',
    primaryColor: '#EA580C',
    secondaryColor: '#0F172A',
    coachName: 'Adam Voges',
    coachingSpecialty: 'Express Pace Fortress',
    reputation: 91,
    trophiesCount: 5,
    historicalTitles: ['2013-14', '2014-15', '2016-17', '2021-22', '2022-23'],
    batPreview: 88,
    bowlPreview: 91,
    fieldPreview: 89,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 5 },
      { label: 'BBL Finals', count: 8 },
      { label: 'Home Win %', count: 74 },
      { label: 'Pace Armory', count: 6 },
    ],
  },
  {
    templateKey: 'hea',
    name: 'Brisbane Heat',
    shortCode: 'HEA',
    leagueCategory: 'BBL',
    homeGround: 'The Gabba, Brisbane',
    foundedYear: 2011,
    boardValue: 104000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#06B6D4',
    secondaryColor: '#0F172A',
    coachName: 'Johan Botha',
    coachingSpecialty: 'Power-Hitting & Bounce Attack',
    reputation: 85,
    trophiesCount: 2,
    historicalTitles: ['2012-13', '2023-24'],
    batPreview: 86,
    bowlPreview: 86,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 2 },
      { label: 'BBL Finals', count: 3 },
      { label: 'Playoff Apps', count: 6 },
      { label: 'Sixes Rank', count: 2 },
    ],
  },
  {
    templateKey: 'sta',
    name: 'Melbourne Stars',
    shortCode: 'STA',
    leagueCategory: 'BBL',
    homeGround: 'Melbourne Cricket Ground (MCG)',
    foundedYear: 2011,
    boardValue: 112000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#16A34A',
    secondaryColor: '#1E293B',
    coachName: 'Peter Moores',
    coachingSpecialty: 'Star Power & MCG Boundaries',
    reputation: 83,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 87,
    bowlPreview: 84,
    fieldPreview: 86,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 0 },
      { label: 'BBL Finals', count: 3 },
      { label: 'Playoff Apps', count: 8 },
      { label: 'Derby Crowds', count: 80 },
    ],
  },
  {
    templateKey: 'hur',
    name: 'Hobart Hurricanes',
    shortCode: 'HUR',
    leagueCategory: 'BBL',
    homeGround: 'Ninja Stadium, Hobart',
    foundedYear: 2011,
    boardValue: 92000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#7C3AED',
    secondaryColor: '#F59E0B',
    coachName: 'Jeff Vaughan',
    coachingSpecialty: 'Aggressive Openers & Variations',
    reputation: 84,
    trophiesCount: 1,
    historicalTitles: ['2024-25'],
    batPreview: 86,
    bowlPreview: 85,
    fieldPreview: 84,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 1 },
      { label: 'BBL Finals', count: 3 },
      { label: 'Playoff Apps', count: 6 },
      { label: 'Home Streak', count: 7 },
    ],
  },
  {
    templateKey: 'str',
    name: 'Adelaide Strikers',
    shortCode: 'STR',
    leagueCategory: 'BBL',
    homeGround: 'Adelaide Oval',
    foundedYear: 2011,
    boardValue: 96000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#0284C7',
    secondaryColor: '#FACC15',
    coachName: 'Tim Paine',
    coachingSpecialty: 'Wrist Spin & Top-Order Fireworks',
    reputation: 84,
    trophiesCount: 1,
    historicalTitles: ['2017-18'],
    batPreview: 85,
    bowlPreview: 86,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 1 },
      { label: 'BBL Finals', count: 1 },
      { label: 'Playoff Apps', count: 7 },
      { label: 'NYE Crowds', count: 42 },
    ],
  },
  {
    templateKey: 'ren',
    name: 'Melbourne Renegades',
    shortCode: 'REN',
    leagueCategory: 'BBL',
    homeGround: 'Marvel Stadium, Melbourne',
    foundedYear: 2011,
    boardValue: 98000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#DC2626',
    secondaryColor: '#111827',
    coachName: 'Cameron White',
    coachingSpecialty: 'Counter-Attacking Spin & Quicks',
    reputation: 82,
    trophiesCount: 1,
    historicalTitles: ['2018-19'],
    batPreview: 85,
    bowlPreview: 84,
    fieldPreview: 84,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 1 },
      { label: 'BBL Finals', count: 1 },
      { label: 'Playoff Apps', count: 4 },
      { label: 'Spin Control', count: 8 },
    ],
  },
  {
    templateKey: 'thu',
    name: 'Sydney Thunder',
    shortCode: 'THU',
    leagueCategory: 'BBL',
    homeGround: 'ENGIE Stadium, Sydney',
    foundedYear: 2011,
    boardValue: 101000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#65A30D',
    secondaryColor: '#18181B',
    coachName: 'Trevor Bayliss',
    coachingSpecialty: 'High-Speed Pace & Youth Batting',
    reputation: 84,
    trophiesCount: 1,
    historicalTitles: ['2015-16'],
    batPreview: 86,
    bowlPreview: 85,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'BBL Titles', count: 1 },
      { label: 'BBL Finals', count: 2 },
      { label: 'Playoff Apps', count: 6 },
      { label: 'WBBL Titles', count: 2 },
    ],
  },

  // 4. The Hundred (All 8 Franchises)
  {
    templateKey: 'oi',
    name: 'Oval Invincibles',
    shortCode: 'OI',
    leagueCategory: 'The Hundred',
    homeGround: 'The Kia Oval, London',
    foundedYear: 2020,
    boardValue: 138000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'ELITE',
    primaryColor: '#0F766E',
    secondaryColor: '#EC4899',
    coachName: 'Tom Moody',
    coachingSpecialty: '100-Ball Power Bowling',
    reputation: 90,
    trophiesCount: 2,
    historicalTitles: ['2023', '2024'],
    batPreview: 88,
    bowlPreview: 89,
    fieldPreview: 87,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 2 },
      { label: 'Women Titles', count: 2 },
      { label: 'Finals Apps', count: 3 },
      { label: 'Table Toppers', count: 2 },
    ],
  },
  {
    templateKey: 'tr',
    name: 'Trent Rockets',
    shortCode: 'TR',
    leagueCategory: 'The Hundred',
    homeGround: 'Trent Bridge, Nottingham',
    foundedYear: 2020,
    boardValue: 118000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#FACC15',
    secondaryColor: '#6D28D9',
    coachName: 'Andy Flower',
    coachingSpecialty: 'Powerplay Six-Hitting',
    reputation: 86,
    trophiesCount: 1,
    historicalTitles: ['2022'],
    batPreview: 88,
    bowlPreview: 85,
    fieldPreview: 86,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 1 },
      { label: 'Finals Apps', count: 1 },
      { label: 'Playoff Apps', count: 2 },
      { label: 'Strike Rate Rank', count: 1 },
    ],
  },
  {
    templateKey: 'sb',
    name: 'Southern Brave',
    shortCode: 'SB',
    leagueCategory: 'The Hundred',
    homeGround: 'Utilita Bowl, Southampton',
    foundedYear: 2020,
    boardValue: 114000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#16A34A',
    secondaryColor: '#1E293B',
    coachName: 'Daren Sammy',
    coachingSpecialty: 'Death Pace & All-Rounders',
    reputation: 86,
    trophiesCount: 1,
    historicalTitles: ['2021'],
    batPreview: 86,
    bowlPreview: 87,
    fieldPreview: 87,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 1 },
      { label: 'Finals Apps', count: 2 },
      { label: 'Playoff Apps', count: 3 },
      { label: 'Pace Economy', count: 1 },
    ],
  },
  {
    templateKey: 'bp',
    name: 'Birmingham Phoenix',
    shortCode: 'BP',
    leagueCategory: 'The Hundred',
    homeGround: 'Edgbaston, Birmingham',
    foundedYear: 2020,
    boardValue: 112000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#EA580C',
    secondaryColor: '#7C3AED',
    coachName: 'Daniel Vettori',
    coachingSpecialty: 'Fearless Strokeplay',
    reputation: 84,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 87,
    bowlPreview: 85,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 0 },
      { label: 'Finals Apps', count: 1 },
      { label: 'Playoff Apps', count: 2 },
      { label: 'Crowd Avg', count: 24 },
    ],
  },
  {
    templateKey: 'mo',
    name: 'Manchester Originals',
    shortCode: 'MO',
    leagueCategory: 'The Hundred',
    homeGround: 'Emirates Old Trafford, Manchester',
    foundedYear: 2020,
    boardValue: 116000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#1E293B',
    secondaryColor: '#EAB308',
    coachName: 'Simon Katich',
    coachingSpecialty: 'Opening Blitz & Left-Arm Pace',
    reputation: 85,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 87,
    bowlPreview: 85,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 0 },
      { label: 'Finals Apps', count: 2 },
      { label: 'Playoff Apps', count: 2 },
      { label: 'Powerplay Edge', count: 2 },
    ],
  },
  {
    templateKey: 'ls',
    name: 'London Spirit',
    shortCode: 'LS',
    leagueCategory: 'The Hundred',
    homeGround: "Lord's Cricket Ground, London",
    foundedYear: 2020,
    boardValue: 132000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'ELITE',
    primaryColor: '#1D4ED8',
    secondaryColor: '#F8FAFC',
    coachName: 'Trevor Bayliss',
    coachingSpecialty: "Lord's Slope & Seam Matchups",
    reputation: 85,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 86,
    bowlPreview: 86,
    fieldPreview: 86,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 0 },
      { label: 'Playoff Apps', count: 1 },
      { label: 'Women Titles', count: 1 },
      { label: 'Home Crowds', count: 29 },
    ],
  },
  {
    templateKey: 'ns',
    name: 'Northern Superchargers',
    shortCode: 'NS',
    leagueCategory: 'The Hundred',
    homeGround: 'Headingley Cricket Ground, Leeds',
    foundedYear: 2020,
    boardValue: 109000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#6D28D9',
    secondaryColor: '#22C55E',
    coachName: 'Andrew Flintoff',
    coachingSpecialty: 'Raw Pace & Middle-Order Power',
    reputation: 84,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 86,
    bowlPreview: 86,
    fieldPreview: 85,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 0 },
      { label: 'League Wins', count: 14 },
      { label: 'Headingley Noise', count: 1 },
      { label: 'Pace Depth', count: 5 },
    ],
  },
  {
    templateKey: 'wf',
    name: 'Welsh Fire',
    shortCode: 'WF',
    leagueCategory: 'The Hundred',
    homeGround: 'Sophia Gardens, Cardiff',
    foundedYear: 2020,
    boardValue: 102000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#DC2626',
    secondaryColor: '#16A34A',
    coachName: 'Mike Hussey',
    coachingSpecialty: 'Aggressive Chase Construction',
    reputation: 82,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 85,
    bowlPreview: 85,
    fieldPreview: 84,
    trophyBreakdown: [
      { label: 'Hundred Titles', count: 0 },
      { label: 'Top 4 Finishes', count: 1 },
      { label: 'Pace Attacks', count: 4 },
      { label: 'Home Support', count: 15 },
    ],
  },

  // 5. Pakistan Super League (All 6 Franchises)
  {
    templateKey: 'lq',
    name: 'Lahore Qalandars',
    shortCode: 'LQ',
    leagueCategory: 'PSL',
    homeGround: 'Gaddafi Stadium, Lahore',
    foundedYear: 2015,
    boardValue: 96000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'ELITE',
    primaryColor: '#16A34A',
    secondaryColor: '#DC2626',
    coachName: 'Darren Gough',
    coachingSpecialty: 'Express Pace Development Program',
    reputation: 88,
    trophiesCount: 2,
    historicalTitles: ['2022', '2023'],
    batPreview: 79,
    bowlPreview: 84,
    fieldPreview: 77,
    trophyBreakdown: [
      { label: 'PSL Titles', count: 2 },
      { label: 'Finals', count: 3 },
      { label: 'Playoff Apps', count: 4 },
      { label: 'PDP Grads', count: 12 },
    ],
  },
  {
    templateKey: 'iu',
    name: 'Islamabad United',
    shortCode: 'IU',
    leagueCategory: 'PSL',
    homeGround: 'Rawalpindi Cricket Stadium',
    foundedYear: 2015,
    boardValue: 94000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#DC2626',
    secondaryColor: '#F97316',
    coachName: 'Mike Hesson',
    coachingSpecialty: 'Analytics & Aggressive Batting Depth',
    reputation: 89,
    trophiesCount: 3,
    historicalTitles: ['2016', '2018', '2024'],
    batPreview: 82,
    bowlPreview: 80,
    fieldPreview: 79,
    trophyBreakdown: [
      { label: 'PSL Titles', count: 3 },
      { label: 'Finals', count: 3 },
      { label: 'Playoff Apps', count: 7 },
      { label: 'Strike Rate', count: 1 },
    ],
  },
  {
    templateKey: 'ms',
    name: 'Multan Sultans',
    shortCode: 'MS',
    leagueCategory: 'PSL',
    homeGround: 'Multan Cricket Stadium, Multan',
    foundedYear: 2017,
    boardValue: 91000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#0D9488',
    secondaryColor: '#FACC15',
    coachName: 'Abdul Rehman',
    coachingSpecialty: 'Matchups, Anchoring & Death Spin',
    reputation: 87,
    trophiesCount: 1,
    historicalTitles: ['2021'],
    batPreview: 81,
    bowlPreview: 82,
    fieldPreview: 80,
    trophyBreakdown: [
      { label: 'PSL Titles', count: 1 },
      { label: 'Finals', count: 4 },
      { label: 'Playoff Apps', count: 5 },
      { label: 'Net Run Rate', count: 1 },
    ],
  },
  {
    templateKey: 'pz',
    name: 'Peshawar Zalmi',
    shortCode: 'PZ',
    leagueCategory: 'PSL',
    homeGround: 'Arbab Niaz Stadium, Peshawar',
    foundedYear: 2015,
    boardValue: 95000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'HIGH',
    primaryColor: '#EAB308',
    secondaryColor: '#18181B',
    coachName: 'Daren Sammy',
    coachingSpecialty: 'Top-Order Flair & Team Spirit',
    reputation: 86,
    trophiesCount: 1,
    historicalTitles: ['2017'],
    batPreview: 83,
    bowlPreview: 78,
    fieldPreview: 78,
    trophyBreakdown: [
      { label: 'PSL Titles', count: 1 },
      { label: 'Finals', count: 4 },
      { label: 'Playoff Apps', count: 8 },
      { label: 'Fan Reach', count: 1 },
    ],
  },
  {
    templateKey: 'kk',
    name: 'Karachi Kings',
    shortCode: 'KK',
    leagueCategory: 'PSL',
    homeGround: 'National Bank Stadium, Karachi',
    foundedYear: 2015,
    boardValue: 93000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#1D4ED8',
    secondaryColor: '#DC2626',
    coachName: 'Ravi Bopara',
    coachingSpecialty: 'Powerplay Seam & Middle-Order Control',
    reputation: 83,
    trophiesCount: 1,
    historicalTitles: ['2020'],
    batPreview: 79,
    bowlPreview: 79,
    fieldPreview: 77,
    trophyBreakdown: [
      { label: 'PSL Titles', count: 1 },
      { label: 'Finals', count: 1 },
      { label: 'Playoff Apps', count: 5 },
      { label: 'Home Crowds', count: 34 },
    ],
  },
  {
    templateKey: 'qg',
    name: 'Quetta Gladiators',
    shortCode: 'QG',
    leagueCategory: 'PSL',
    homeGround: 'Bugti Stadium, Quetta',
    foundedYear: 2015,
    boardValue: 86000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#6D28D9',
    secondaryColor: '#FACC15',
    coachName: 'Shane Watson',
    coachingSpecialty: 'Power-Hitting & Wrist Spinners',
    reputation: 84,
    trophiesCount: 1,
    historicalTitles: ['2019'],
    batPreview: 80,
    bowlPreview: 79,
    fieldPreview: 77,
    trophyBreakdown: [
      { label: 'PSL Titles', count: 1 },
      { label: 'Finals', count: 3 },
      { label: 'Playoff Apps', count: 5 },
      { label: 'Win Streak', count: 6 },
    ],
  },

  // 6. SA20 (All 6 Franchises)
  {
    templateKey: 'sec',
    name: 'Sunrisers Eastern Cape',
    shortCode: 'SEC',
    leagueCategory: 'SA20',
    homeGround: "St George's Park, Gqeberha",
    foundedYear: 2022,
    boardValue: 98000,
    fanbaseDevotion: 'LEGENDARY',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#F26522',
    secondaryColor: '#111827',
    coachName: 'Adrian Birrell',
    coachingSpecialty: 'Relentless Seam Pressure & Fielding',
    reputation: 89,
    trophiesCount: 2,
    historicalTitles: ['2023', '2024'],
    batPreview: 80,
    bowlPreview: 83,
    fieldPreview: 84,
    trophyBreakdown: [
      { label: 'SA20 Titles', count: 2 },
      { label: 'Finals', count: 3 },
      { label: 'Playoff Apps', count: 3 },
      { label: 'Brass Band', count: 1 },
    ],
  },
  {
    templateKey: 'mict',
    name: 'MI Cape Town',
    shortCode: 'MICT',
    leagueCategory: 'SA20',
    homeGround: 'Newlands Cricket Ground, Cape Town',
    foundedYear: 2022,
    boardValue: 108000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'ELITE',
    primaryColor: '#004BA0',
    secondaryColor: '#D4AF37',
    coachName: 'Robin Peterson',
    coachingSpecialty: 'All-Round Depth & Newlands Bounce',
    reputation: 88,
    trophiesCount: 1,
    historicalTitles: ['2025'],
    batPreview: 83,
    bowlPreview: 84,
    fieldPreview: 82,
    trophyBreakdown: [
      { label: 'SA20 Titles', count: 1 },
      { label: 'Finals', count: 1 },
      { label: 'Bonus Points', count: 8 },
      { label: 'Pace Depth', count: 6 },
    ],
  },
  {
    templateKey: 'jsk',
    name: 'Joburg Super Kings',
    shortCode: 'JSK',
    leagueCategory: 'SA20',
    homeGround: 'The Wanderers Stadium, Johannesburg',
    foundedYear: 2022,
    boardValue: 102000,
    fanbaseDevotion: 'VERY HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#FACC15',
    secondaryColor: '#1D4ED8',
    coachName: 'Stephen Fleming',
    coachingSpecialty: 'Highveld Boundaries & Spin Chokehold',
    reputation: 85,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 81,
    bowlPreview: 79,
    fieldPreview: 81,
    trophyBreakdown: [
      { label: 'SA20 Titles', count: 0 },
      { label: 'Playoff Apps', count: 3 },
      { label: 'Bullring Wins', count: 11 },
      { label: 'T20 Experience', count: 1 },
    ],
  },
  {
    templateKey: 'pr',
    name: 'Paarl Royals',
    shortCode: 'PR',
    leagueCategory: 'SA20',
    homeGround: 'Boland Park, Paarl',
    foundedYear: 2022,
    boardValue: 92000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#EC4899',
    secondaryColor: '#1E3A8A',
    coachName: 'Trevor Penney',
    coachingSpecialty: 'Boland Spin Craft & Middle Overs',
    reputation: 84,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 80,
    bowlPreview: 80,
    fieldPreview: 80,
    trophyBreakdown: [
      { label: 'SA20 Titles', count: 0 },
      { label: 'Playoff Apps', count: 3 },
      { label: 'Home Fortress', count: 5 },
      { label: 'Spin Overs', count: 1 },
    ],
  },
  {
    templateKey: 'pc',
    name: 'Pretoria Capitals',
    shortCode: 'PC',
    leagueCategory: 'SA20',
    homeGround: 'SuperSport Park, Centurion',
    foundedYear: 2022,
    boardValue: 94000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'VERY HIGH',
    primaryColor: '#0284C7',
    secondaryColor: '#DC2626',
    coachName: 'Jonathan Trott',
    coachingSpecialty: 'Centurion Tempo & Express Seam',
    reputation: 83,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 80,
    bowlPreview: 79,
    fieldPreview: 80,
    trophyBreakdown: [
      { label: 'SA20 Titles', count: 0 },
      { label: 'Finals', count: 1 },
      { label: 'Table Toppers', count: 1 },
      { label: 'Sixes Hit', count: 84 },
    ],
  },
  {
    templateKey: 'dsg',
    name: "Durban's Super Giants",
    shortCode: 'DSG',
    leagueCategory: 'SA20',
    homeGround: 'Kingsmead, Durban',
    foundedYear: 2022,
    boardValue: 93000,
    fanbaseDevotion: 'HIGH',
    youthFacilities: 'HIGH',
    primaryColor: '#0EA5E9',
    secondaryColor: '#1E293B',
    coachName: 'Lance Klusener',
    coachingSpecialty: 'Power Finishes & Mystery Spin',
    reputation: 84,
    trophiesCount: 0,
    historicalTitles: [],
    batPreview: 82,
    bowlPreview: 79,
    fieldPreview: 79,
    trophyBreakdown: [
      { label: 'SA20 Titles', count: 0 },
      { label: 'Finals', count: 1 },
      { label: 'Coastal Wins', count: 9 },
      { label: 'Death Power', count: 2 },
    ],
  },
];

// Real-world Coaching Staff Catalog
export const COACH_CATALOG: CoachCatalogEntry[] = [
  { id: 'c_fleming', name: 'Stephen Fleming', country: 'New Zealand', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 4, fieldStars: 4, wkStars: 3, signingFeeLakhs: 280, weeklyWageLakhs: 14, legacyNote: '5x IPL Champion Head Coach' },
  { id: 'c_dravid', name: 'Rahul Dravid', country: 'India', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 3, fieldStars: 5, wkStars: 4, signingFeeLakhs: 295, weeklyWageLakhs: 15, legacyNote: 'World Cup Champion Coach & Test Legend' },
  { id: 'c_ponting', name: 'Ricky Ponting', country: 'Australia', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 3, fieldStars: 5, wkStars: 3, signingFeeLakhs: 290, weeklyWageLakhs: 15, legacyNote: '3x World Cup Captain & Elite Tactician' },
  { id: 'c_gambhir', name: 'Gautam Gambhir', country: 'India', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 4, fieldStars: 4, wkStars: 3, signingFeeLakhs: 270, weeklyWageLakhs: 13, legacyNote: '2x IPL Captain & Title Mentor' },
  { id: 'c_flower', name: 'Andy Flower', country: 'England', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 4, fieldStars: 4, wkStars: 5, signingFeeLakhs: 260, weeklyWageLakhs: 13, legacyNote: 'Ashes & Global T20 Title Winner' },
  { id: 'c_jayawardene', name: 'Mahela Jayawardene', country: 'Sri Lanka', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 4, fieldStars: 4, wkStars: 3, signingFeeLakhs: 265, weeklyWageLakhs: 13, legacyNote: '3x IPL Winner Tactician' },
  { id: 'c_mccullum', name: 'Brendon McCullum', country: 'New Zealand', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 3, fieldStars: 5, wkStars: 4, signingFeeLakhs: 275, weeklyWageLakhs: 14, legacyNote: 'Aggressive White & Red-Ball Architect' },
  { id: 'c_kirsten', name: 'Gary Kirsten', country: 'South Africa', role: 'Head Coach', knowledge: 'Expert', batStars: 5, bowlStars: 4, fieldStars: 4, wkStars: 3, signingFeeLakhs: 255, weeklyWageLakhs: 12, legacyNote: '2011 ODI World Cup Champion Coach' },
  { id: 'c_shastri', name: 'Ravi Shastri', country: 'India', role: 'Head Coach', knowledge: 'Expert', batStars: 4, bowlStars: 4, fieldStars: 4, wkStars: 3, signingFeeLakhs: 245, weeklyWageLakhs: 12, legacyNote: 'Back-to-Back Test Series Architect' },
  { id: 'c_vettori', name: 'Daniel Vettori', country: 'New Zealand', role: 'Head Coach', knowledge: 'Accomplished', batStars: 3, bowlStars: 5, fieldStars: 4, wkStars: 2, signingFeeLakhs: 185, weeklyWageLakhs: 9, legacyNote: 'Left-Arm Spin Mastermind & Strategy Lead' },
  { id: 'c_sangakkara', name: 'Kumar Sangakkara', country: 'Sri Lanka', role: 'Batting Coach', knowledge: 'Expert', batStars: 5, bowlStars: 2, fieldStars: 4, wkStars: 5, signingFeeLakhs: 240, weeklyWageLakhs: 11, legacyNote: '12,000+ Test Runs & Elite Keeper-Batter' },
  { id: 'c_hussey', name: 'Michael Hussey', country: 'Australia', role: 'Batting Coach', knowledge: 'Expert', batStars: 5, bowlStars: 2, fieldStars: 5, wkStars: 2, signingFeeLakhs: 215, weeklyWageLakhs: 10, legacyNote: 'Mr. Cricket — Finisher & Chase Specialist' },
  { id: 'c_kallis', name: 'Jacques Kallis', country: 'South Africa', role: 'Batting Coach', knowledge: 'Expert', batStars: 5, bowlStars: 4, fieldStars: 5, wkStars: 2, signingFeeLakhs: 235, weeklyWageLakhs: 11, legacyNote: 'Greatest All-Format All-Rounder Mentor' },
  { id: 'c_hayden', name: 'Matthew Hayden', country: 'Australia', role: 'Batting Coach', knowledge: 'Accomplished', batStars: 5, bowlStars: 2, fieldStars: 4, wkStars: 2, signingFeeLakhs: 180, weeklyWageLakhs: 9, legacyNote: 'Powerplay Opener Dominance' },
  { id: 'c_abhishek_nayar', name: 'Abhishek Nayar', country: 'India', role: 'Batting Coach', knowledge: 'Accomplished', batStars: 4, bowlStars: 3, fieldStars: 4, wkStars: 2, signingFeeLakhs: 135, weeklyWageLakhs: 7, legacyNote: 'Player Rebuilding & Strike Mechanics' },
  { id: 'c_rathour', name: 'Vikram Rathour', country: 'India', role: 'Batting Coach', knowledge: 'Accomplished', batStars: 4, bowlStars: 2, fieldStars: 4, wkStars: 2, signingFeeLakhs: 150, weeklyWageLakhs: 7, legacyNote: 'World Cup T20 Batting Coach' },
  { id: 'c_malinga', name: 'Lasith Malinga', country: 'Sri Lanka', role: 'Bowling Coach', knowledge: 'Expert', batStars: 1, bowlStars: 5, fieldStars: 3, wkStars: 1, signingFeeLakhs: 225, weeklyWageLakhs: 11, legacyNote: 'Death Yorker & Sling Action Specialist' },
  { id: 'c_bond', name: 'Shane Bond', country: 'New Zealand', role: 'Bowling Coach', knowledge: 'Expert', batStars: 2, bowlStars: 5, fieldStars: 4, wkStars: 1, signingFeeLakhs: 215, weeklyWageLakhs: 10, legacyNote: '5x Champion Pace Bowling Architect' },
  { id: 'c_steyn', name: 'Dale Steyn', country: 'South Africa', role: 'Bowling Coach', knowledge: 'Expert', batStars: 2, bowlStars: 5, fieldStars: 4, wkStars: 1, signingFeeLakhs: 220, weeklyWageLakhs: 10, legacyNote: 'Express Outswing & Pace Mentality' },
  { id: 'c_morkel', name: 'Morne Morkel', country: 'South Africa', role: 'Bowling Coach', knowledge: 'Accomplished', batStars: 2, bowlStars: 5, fieldStars: 3, wkStars: 1, signingFeeLakhs: 175, weeklyWageLakhs: 8, legacyNote: 'Hit-the-Deck Bounce Specialist' },
  { id: 'c_zaheer', name: 'Zaheer Khan', country: 'India', role: 'Bowling Coach', knowledge: 'Expert', batStars: 2, bowlStars: 5, fieldStars: 4, wkStars: 1, signingFeeLakhs: 210, weeklyWageLakhs: 10, legacyNote: 'Reverse Swing & Left-Arm Angle Tactician' },
  { id: 'c_nehra', name: 'Ashish Nehra', country: 'India', role: 'Bowling Coach', knowledge: 'Expert', batStars: 2, bowlStars: 5, fieldStars: 3, wkStars: 1, signingFeeLakhs: 205, weeklyWageLakhs: 10, legacyNote: 'IPL Winning Tactical Pace Coach' },
  { id: 'c_arun', name: 'Bharat Arun', country: 'India', role: 'Bowling Coach', knowledge: 'Expert', batStars: 1, bowlStars: 5, fieldStars: 3, wkStars: 1, signingFeeLakhs: 195, weeklyWageLakhs: 9, legacyNote: 'Indian Pace Quartet Builder' },
  { id: 'c_bravo', name: 'Dwayne Bravo', country: 'West Indies', role: 'Bowling Coach', knowledge: 'Accomplished', batStars: 4, bowlStars: 5, fieldStars: 5, wkStars: 1, signingFeeLakhs: 185, weeklyWageLakhs: 9, legacyNote: 'Slower-Ball Death Over Maestro' },
  { id: 'c_rhodes', name: 'Jonty Rhodes', country: 'South Africa', role: 'Fielding Coach', knowledge: 'Expert', batStars: 4, bowlStars: 1, fieldStars: 5, wkStars: 2, signingFeeLakhs: 190, weeklyWageLakhs: 9, legacyNote: 'Greatest Fielding Tactician in History' },
  { id: 'c_dilip', name: 'T Dilip', country: 'India', role: 'Fielding Coach', knowledge: 'Accomplished', batStars: 2, bowlStars: 1, fieldStars: 5, wkStars: 3, signingFeeLakhs: 135, weeklyWageLakhs: 6, legacyNote: 'Slip Catching & Direct-Hit Culture' },
  { id: 'c_collingwood', name: 'Paul Collingwood', country: 'England', role: 'Fielding Coach', knowledge: 'Accomplished', batStars: 4, bowlStars: 3, fieldStars: 5, wkStars: 2, signingFeeLakhs: 145, weeklyWageLakhs: 7, legacyNote: '2010 T20 WC Winning Captain' },
  { id: 'c_kaif', name: 'Mohammad Kaif', country: 'India', role: 'Fielding Coach', knowledge: 'Competent', batStars: 4, bowlStars: 1, fieldStars: 5, wkStars: 2, signingFeeLakhs: 105, weeklyWageLakhs: 5, legacyNote: 'Inner-Ring Agility Specialist' },
  { id: 'c_karthik', name: 'Dinesh Karthik', country: 'India', role: 'Wicketkeeping Coach', knowledge: 'Accomplished', batStars: 5, bowlStars: 1, fieldStars: 4, wkStars: 5, signingFeeLakhs: 165, weeklyWageLakhs: 8, legacyNote: 'Finisher & Modern Glovework Mentor' },
  { id: 'c_foster', name: 'James Foster', country: 'England', role: 'Wicketkeeping Coach', knowledge: 'Accomplished', batStars: 3, bowlStars: 1, fieldStars: 4, wkStars: 5, signingFeeLakhs: 140, weeklyWageLakhs: 6, legacyNote: 'Standing-Up to Spin Glove Specialist' },
  { id: 'c_gilchrist', name: 'Adam Gilchrist', country: 'Australia', role: 'Wicketkeeping Coach', knowledge: 'Expert', batStars: 5, bowlStars: 1, fieldStars: 4, wkStars: 5, signingFeeLakhs: 230, weeklyWageLakhs: 11, legacyNote: '3x World Cup Winner & WK Pioneer' },
  { id: 'c_boucher', name: 'Mark Boucher', country: 'South Africa', role: 'Wicketkeeping Coach', knowledge: 'Expert', batStars: 4, bowlStars: 1, fieldStars: 4, wkStars: 5, signingFeeLakhs: 195, weeklyWageLakhs: 9, legacyNote: 'Record Test Dismissals Keeper-Coach' },
];

export const SCOUT_CATALOG: ScoutCatalogEntry[] = [
  { id: 's_wright', name: 'John Wright', country: 'New Zealand', experienceStars: 5, judgementStars: 5, networkCostLakhs: 120, specialtyRegion: 'India & Domestic T20' },
  { id: 's_prasad', name: 'MSK Prasad', country: 'India', experienceStars: 5, judgementStars: 4, networkCostLakhs: 95, specialtyRegion: 'India Ranji & U19' },
  { id: 's_chappell', name: 'Greg Chappell', country: 'Australia', experienceStars: 5, judgementStars: 5, networkCostLakhs: 115, specialtyRegion: 'Australia & BBL Pathway' },
  { id: 's_kemp', name: 'Rob Key', country: 'England', experienceStars: 4, judgementStars: 5, networkCostLakhs: 105, specialtyRegion: 'England & The Hundred' },
  { id: 's_agarkar', name: 'Ajit Agarkar', country: 'India', experienceStars: 5, judgementStars: 5, networkCostLakhs: 125, specialtyRegion: 'India All-Format' },
  { id: 's_nannes', name: 'Dirk Nannes', country: 'Australia', experienceStars: 4, judgementStars: 4, networkCostLakhs: 82, specialtyRegion: 'BBL & T20 Circuits' },
  { id: 's_more', name: 'Kiran More', country: 'India', experienceStars: 5, judgementStars: 4, networkCostLakhs: 90, specialtyRegion: 'West & Central India' },
  { id: 's_conrad', name: 'Graeme Pollock', country: 'South Africa', experienceStars: 4, judgementStars: 5, networkCostLakhs: 92, specialtyRegion: 'South Africa Pace' },
  { id: 's_walsh', name: 'Courtney Walsh', country: 'West Indies', experienceStars: 5, judgementStars: 4, networkCostLakhs: 98, specialtyRegion: 'Caribbean Pace' },
  { id: 's_gul', name: 'Umar Gul', country: 'Pakistan', experienceStars: 4, judgementStars: 4, networkCostLakhs: 84, specialtyRegion: 'Pakistan Quicks' },
  { id: 's_vaas', name: 'Chaminda Vaas', country: 'Sri Lanka', experienceStars: 4, judgementStars: 5, networkCostLakhs: 88, specialtyRegion: 'Sri Lanka & Mystery Spin' },
  { id: 's_stanikzai', name: 'Asghar Afghan', country: 'Afghanistan', experienceStars: 4, judgementStars: 4, networkCostLakhs: 75, specialtyRegion: 'Afghanistan & Emerging Asia' },
  { id: 's_morgan', name: 'Eoin Morgan', country: 'England', experienceStars: 5, judgementStars: 5, networkCostLakhs: 118, specialtyRegion: 'White-Ball Specialists' },
  { id: 's_mills', name: 'Kyle Mills', country: 'New Zealand', experienceStars: 4, judgementStars: 4, networkCostLakhs: 80, specialtyRegion: 'New Zealand Swing' },
];

type CompactPlayerTuple = [
  string,
  string,
  LeagueCategory,
  'BAT' | 'BWL' | 'AR' | 'WK',
  'L' | 'M' | 'S' | 'D',
  number,
  'R' | 'L',
  string
];

const P = (
  name: string,
  country: string,
  leagueOrigin: LeagueCategory,
  role: 'BAT' | 'BWL' | 'AR' | 'WK',
  tier: 'L' | 'M' | 'S' | 'D',
  age: number,
  batHand: 'R' | 'L',
  bowlType: string
): CompactPlayerTuple => [name, country, leagueOrigin, role, tier, age, batHand, bowlType];

// 100% Authentic Real-Life Cricketers ONLY (IPL 2008-2026 Auction Pool, Internationals, BBL, The Hundred)
// Zero fake suffixes (no Jr/Sr/club tags) and zero invented names.
const CURATED_REAL_PLAYERS: CompactPlayerTuple[] = [
  // ================= IPL (2008–2026): MARQUEE & ICONS =================
  P('Virat Kohli', 'India', 'IPL', 'BAT', 'L', 36, 'R', 'Right-arm medium'),
  P('MS Dhoni', 'India', 'IPL', 'WK', 'L', 43, 'R', 'None'),
  P('Rohit Sharma', 'India', 'IPL', 'BAT', 'L', 37, 'R', 'Right-arm off-break'),
  P('Jasprit Bumrah', 'India', 'IPL', 'BWL', 'L', 31, 'R', 'Right-arm fast'),
  P('Sachin Tendulkar', 'India', 'IPL', 'BAT', 'L', 38, 'R', 'Right-arm leg-break'),
  P('AB de Villiers', 'South Africa', 'IPL', 'WK', 'L', 36, 'R', 'None'),
  P('Chris Gayle', 'West Indies', 'IPL', 'BAT', 'L', 38, 'L', 'Right-arm off-break'),
  P('Suresh Raina', 'India', 'IPL', 'BAT', 'L', 34, 'L', 'Right-arm off-break'),
  P('Ravindra Jadeja', 'India', 'IPL', 'AR', 'L', 36, 'L', 'Left-arm orthodox'),
  P('Hardik Pandya', 'India', 'IPL', 'AR', 'L', 31, 'R', 'Right-arm fast-medium'),
  P('Suryakumar Yadav', 'India', 'IPL', 'BAT', 'L', 34, 'R', 'None'),
  P('Shubman Gill', 'India', 'IPL', 'BAT', 'L', 25, 'R', 'None'),
  P('Yashasvi Jaiswal', 'India', 'IPL', 'BAT', 'L', 23, 'L', 'Right-arm leg-break'),
  P('Rishabh Pant', 'India', 'IPL', 'WK', 'L', 27, 'L', 'None'),
  P('KL Rahul', 'India', 'IPL', 'WK', 'L', 32, 'R', 'None'),
  P('Shreyas Iyer', 'India', 'IPL', 'BAT', 'L', 30, 'R', 'None'),
  P('Sanju Samson', 'India', 'IPL', 'WK', 'M', 30, 'R', 'None'),
  P('Rashid Khan', 'Afghanistan', 'IPL', 'BWL', 'L', 26, 'R', 'Right-arm leg-break'),
  P('Sunil Narine', 'West Indies', 'IPL', 'AR', 'L', 36, 'L', 'Right-arm off-break'),
  P('Andre Russell', 'West Indies', 'IPL', 'AR', 'L', 36, 'R', 'Right-arm fast'),
  P('Jos Buttler', 'England', 'IPL', 'WK', 'L', 34, 'R', 'None'),
  P('Pat Cummins', 'Australia', 'IPL', 'BWL', 'L', 31, 'R', 'Right-arm fast'),
  P('Mitchell Starc', 'Australia', 'IPL', 'BWL', 'L', 35, 'L', 'Left-arm fast'),
  P('Trent Boult', 'New Zealand', 'IPL', 'BWL', 'L', 35, 'R', 'Left-arm fast-medium'),
  P('Kagiso Rabada', 'South Africa', 'IPL', 'BWL', 'L', 29, 'L', 'Right-arm fast'),
  P('Heinrich Klaasen', 'South Africa', 'IPL', 'WK', 'L', 33, 'R', 'None'),
  P('Nicholas Pooran', 'West Indies', 'IPL', 'WK', 'L', 29, 'L', 'None'),
  P('Travis Head', 'Australia', 'IPL', 'BAT', 'L', 31, 'L', 'Right-arm off-break'),
  P('David Warner', 'Australia', 'IPL', 'BAT', 'L', 38, 'L', 'None'),
  P('Glenn Maxwell', 'Australia', 'IPL', 'AR', 'M', 36, 'R', 'Right-arm off-break'),
  P('Axar Patel', 'India', 'IPL', 'AR', 'L', 31, 'L', 'Left-arm orthodox'),
  P('Kuldeep Yadav', 'India', 'IPL', 'BWL', 'L', 30, 'L', 'Left-arm wrist-spin'),
  P('Yuzvendra Chahal', 'India', 'IPL', 'BWL', 'L', 34, 'R', 'Right-arm leg-break'),
  P('Mohammed Shami', 'India', 'IPL', 'BWL', 'L', 34, 'R', 'Right-arm fast'),
  P('Mohammed Siraj', 'India', 'IPL', 'BWL', 'M', 30, 'R', 'Right-arm fast'),
  P('Arshdeep Singh', 'India', 'IPL', 'BWL', 'M', 26, 'L', 'Left-arm fast-medium'),
  P('Ravichandran Ashwin', 'India', 'IPL', 'AR', 'L', 38, 'R', 'Right-arm off-break'),
  P('Bhuvneshwar Kumar', 'India', 'IPL', 'BWL', 'M', 35, 'R', 'Right-arm fast-medium'),
  P('Abhishek Sharma', 'India', 'IPL', 'AR', 'M', 24, 'L', 'Left-arm orthodox'),
  P('Ruturaj Gaikwad', 'India', 'IPL', 'BAT', 'M', 28, 'R', 'None'),
  P('Tilak Varma', 'India', 'IPL', 'BAT', 'M', 22, 'L', 'Right-arm off-break'),
  P('Rinku Singh', 'India', 'IPL', 'BAT', 'M', 27, 'L', 'None'),
  P('Shivam Dube', 'India', 'IPL', 'AR', 'M', 31, 'L', 'Right-arm medium'),
  P('Ishan Kishan', 'India', 'IPL', 'WK', 'M', 26, 'L', 'None'),
  P('Sai Sudharsan', 'India', 'IPL', 'BAT', 'M', 23, 'L', 'Right-arm leg-break'),
  P('Riyan Parag', 'India', 'IPL', 'AR', 'M', 23, 'R', 'Right-arm off-break'),
  P('Nitish Kumar Reddy', 'India', 'IPL', 'AR', 'M', 21, 'R', 'Right-arm medium-fast'),
  P('Varun Chakaravarthy', 'India', 'IPL', 'BWL', 'L', 33, 'R', 'Right-arm leg-break'),
  P('Ravi Bishnoi', 'India', 'IPL', 'BWL', 'M', 24, 'R', 'Right-arm leg-break'),
  P('Harshit Rana', 'India', 'IPL', 'BWL', 'M', 23, 'R', 'Right-arm fast'),
  P('Mayank Yadav', 'India', 'IPL', 'BWL', 'M', 22, 'R', 'Right-arm fast'),
  P('Matheesha Pathirana', 'Sri Lanka', 'IPL', 'BWL', 'M', 22, 'R', 'Right-arm fast'),
  P('Noor Ahmad', 'Afghanistan', 'IPL', 'BWL', 'M', 20, 'R', 'Left-arm wrist-spin'),
  P('Phil Salt', 'England', 'IPL', 'WK', 'M', 28, 'R', 'None'),
  P('Liam Livingstone', 'England', 'IPL', 'AR', 'M', 31, 'R', 'Right-arm leg-break'),
  P('Sam Curran', 'England', 'IPL', 'AR', 'M', 26, 'L', 'Left-arm fast-medium'),
  P('Jofra Archer', 'England', 'IPL', 'BWL', 'L', 29, 'R', 'Right-arm fast'),
  P('Josh Hazlewood', 'Australia', 'IPL', 'BWL', 'L', 34, 'L', 'Right-arm fast'),
  P('Marcus Stoinis', 'Australia', 'IPL', 'AR', 'M', 35, 'R', 'Right-arm medium'),
  P('Mitchell Marsh', 'Australia', 'IPL', 'AR', 'M', 33, 'R', 'Right-arm fast-medium'),
  P('Cameron Green', 'Australia', 'IPL', 'AR', 'M', 25, 'R', 'Right-arm fast-medium'),
  P('Tim David', 'Australia', 'IPL', 'BAT', 'M', 28, 'R', 'Right-arm off-break'),
  P('Faf du Plessis', 'South Africa', 'IPL', 'BAT', 'M', 40, 'R', 'None'),
  P('Quinton de Kock', 'South Africa', 'IPL', 'WK', 'M', 32, 'L', 'None'),
  P('David Miller', 'South Africa', 'IPL', 'BAT', 'M', 35, 'L', 'None'),
  P('Tristan Stubbs', 'South Africa', 'IPL', 'BAT', 'M', 24, 'R', 'Right-arm off-break'),
  P('Marco Jansen', 'South Africa', 'IPL', 'AR', 'M', 24, 'R', 'Left-arm fast'),
  P('Aiden Markram', 'South Africa', 'IPL', 'BAT', 'M', 30, 'R', 'Right-arm off-break'),
  P('Devon Conway', 'New Zealand', 'IPL', 'WK', 'M', 33, 'L', 'None'),
  P('Rachin Ravindra', 'New Zealand', 'IPL', 'AR', 'M', 25, 'L', 'Left-arm orthodox'),
  P('Daryl Mitchell', 'New Zealand', 'IPL', 'AR', 'M', 33, 'R', 'Right-arm medium'),
  P('Mitchell Santner', 'New Zealand', 'IPL', 'AR', 'M', 33, 'L', 'Left-arm orthodox'),
  P('Lockie Ferguson', 'New Zealand', 'IPL', 'BWL', 'M', 33, 'R', 'Right-arm fast'),
  P('Shimron Hetmyer', 'West Indies', 'IPL', 'BAT', 'M', 28, 'L', 'None'),
  P('Rovman Powell', 'West Indies', 'IPL', 'BAT', 'M', 31, 'R', 'Right-arm medium'),
  P('Wanindu Hasaranga', 'Sri Lanka', 'IPL', 'AR', 'M', 27, 'R', 'Right-arm leg-break'),
  P('Maheesh Theekshana', 'Sri Lanka', 'IPL', 'BWL', 'M', 24, 'R', 'Right-arm off-break'),
  P('Mustafizur Rahman', 'Bangladesh', 'IPL', 'BWL', 'M', 29, 'L', 'Left-arm fast-medium'),
  P('Rahmanullah Gurbaz', 'Afghanistan', 'IPL', 'WK', 'M', 23, 'R', 'None'),
  P('Azmatullah Omarzai', 'Afghanistan', 'IPL', 'AR', 'M', 24, 'R', 'Right-arm fast-medium'),
  P('Fazalhaq Farooqi', 'Afghanistan', 'IPL', 'BWL', 'M', 24, 'L', 'Left-arm fast-medium'),

  // IPL 2008–2026 Indian Squads, Auction Classics & Emerging Talent
  P('Virender Sehwag', 'India', 'IPL', 'BAT', 'L', 36, 'R', 'Right-arm off-break'),
  P('Gautam Gambhir', 'India', 'IPL', 'BAT', 'L', 35, 'L', 'None'),
  P('Yuvraj Singh', 'India', 'IPL', 'AR', 'L', 35, 'L', 'Left-arm orthodox'),
  P('Shikhar Dhawan', 'India', 'IPL', 'BAT', 'L', 38, 'L', 'None'),
  P('Harbhajan Singh', 'India', 'IPL', 'BWL', 'L', 38, 'R', 'Right-arm off-break'),
  P('Anil Kumble', 'India', 'IPL', 'BWL', 'L', 39, 'R', 'Right-arm leg-break'),
  P('Zaheer Khan', 'India', 'IPL', 'BWL', 'L', 36, 'R', 'Left-arm fast-medium'),
  P('Sourav Ganguly', 'India', 'IPL', 'BAT', 'M', 38, 'L', 'Right-arm medium'),
  P('Rahul Dravid', 'India', 'IPL', 'BAT', 'L', 38, 'R', 'None'),
  P('VVS Laxman', 'India', 'IPL', 'BAT', 'M', 36, 'R', 'None'),
  P('Ajinkya Rahane', 'India', 'IPL', 'BAT', 'M', 36, 'R', 'None'),
  P('Cheteshwar Pujara', 'India', 'IPL', 'BAT', 'L', 36, 'R', 'None'),
  P('Ambati Rayudu', 'India', 'IPL', 'BAT', 'M', 37, 'R', 'None'),
  P('Robin Uthappa', 'India', 'IPL', 'WK', 'M', 36, 'R', 'None'),
  P('Dinesh Karthik', 'India', 'IPL', 'WK', 'M', 39, 'R', 'None'),
  P('Parthiv Patel', 'India', 'IPL', 'WK', 'M', 35, 'L', 'None'),
  P('Wriddhiman Saha', 'India', 'IPL', 'WK', 'M', 39, 'R', 'None'),
  P('Murali Vijay', 'India', 'IPL', 'BAT', 'M', 35, 'R', 'None'),
  P('Yusuf Pathan', 'India', 'IPL', 'AR', 'M', 37, 'R', 'Right-arm off-break'),
  P('Irfan Pathan', 'India', 'IPL', 'AR', 'M', 34, 'L', 'Left-arm fast-medium'),
  P('Ashish Nehra', 'India', 'IPL', 'BWL', 'M', 37, 'R', 'Left-arm fast-medium'),
  P('Umesh Yadav', 'India', 'IPL', 'BWL', 'M', 37, 'R', 'Right-arm fast'),
  P('Ishant Sharma', 'India', 'IPL', 'BWL', 'M', 36, 'R', 'Right-arm fast-medium'),
  P('Amit Mishra', 'India', 'IPL', 'BWL', 'M', 41, 'R', 'Right-arm leg-break'),
  P('Piyush Chawla', 'India', 'IPL', 'BWL', 'M', 36, 'L', 'Right-arm leg-break'),
  P('Praveen Kumar', 'India', 'IPL', 'BWL', 'M', 31, 'R', 'Right-arm medium'),
  P('RP Singh', 'India', 'IPL', 'BWL', 'M', 32, 'R', 'Left-arm fast-medium'),
  P('Munaf Patel', 'India', 'IPL', 'BWL', 'M', 34, 'R', 'Right-arm fast-medium'),
  P('Pragyan Ojha', 'India', 'IPL', 'BWL', 'M', 32, 'L', 'Left-arm orthodox'),
  P('Harshal Patel', 'India', 'IPL', 'BWL', 'M', 34, 'R', 'Right-arm medium-fast'),
  P('Krunal Pandya', 'India', 'IPL', 'AR', 'M', 33, 'L', 'Left-arm orthodox'),
  P('Deepak Chahar', 'India', 'IPL', 'BWL', 'M', 32, 'R', 'Right-arm medium-fast'),
  P('Shardul Thakur', 'India', 'IPL', 'AR', 'M', 33, 'R', 'Right-arm fast-medium'),
  P('Washington Sundar', 'India', 'IPL', 'AR', 'M', 25, 'L', 'Right-arm off-break'),
  P('T Natarajan', 'India', 'IPL', 'BWL', 'M', 33, 'L', 'Left-arm fast-medium'),
  P('Avesh Khan', 'India', 'IPL', 'BWL', 'M', 28, 'R', 'Right-arm fast'),
  P('Prasidh Krishna', 'India', 'IPL', 'BWL', 'M', 29, 'R', 'Right-arm fast'),
  P('Mukesh Kumar', 'India', 'IPL', 'BWL', 'M', 31, 'R', 'Right-arm fast-medium'),
  P('Khaleel Ahmed', 'India', 'IPL', 'BWL', 'M', 27, 'R', 'Left-arm fast-medium'),
  P('Mohit Sharma', 'India', 'IPL', 'BWL', 'M', 36, 'R', 'Right-arm medium'),
  P('Sandeep Sharma', 'India', 'IPL', 'BWL', 'M', 31, 'R', 'Right-arm medium'),
  P('Jaydev Unadkat', 'India', 'IPL', 'BWL', 'S', 33, 'R', 'Left-arm fast-medium'),
  P('Rahul Chahar', 'India', 'IPL', 'BWL', 'S', 25, 'R', 'Right-arm leg-break'),
  P('Sai Kishore', 'India', 'IPL', 'BWL', 'S', 28, 'L', 'Left-arm orthodox'),
  P('Shahbaz Ahmed', 'India', 'IPL', 'AR', 'S', 30, 'L', 'Left-arm orthodox'),
  P('Rahul Tewatia', 'India', 'IPL', 'AR', 'M', 31, 'L', 'Right-arm leg-break'),
  P('Venkatesh Iyer', 'India', 'IPL', 'AR', 'M', 30, 'L', 'Right-arm medium'),
  P('Rajat Patidar', 'India', 'IPL', 'BAT', 'M', 31, 'R', 'None'),
  P('Nitish Rana', 'India', 'IPL', 'BAT', 'M', 31, 'L', 'Right-arm off-break'),
  P('Deepak Hooda', 'India', 'IPL', 'AR', 'S', 29, 'R', 'Right-arm off-break'),
  P('Kedar Jadhav', 'India', 'IPL', 'AR', 'S', 38, 'R', 'Right-arm off-break'),
  P('Manish Pandey', 'India', 'IPL', 'BAT', 'S', 35, 'R', 'None'),
  P('Karun Nair', 'India', 'IPL', 'BAT', 'S', 33, 'R', 'None'),
  P('Mayank Agarwal', 'India', 'IPL', 'BAT', 'M', 34, 'R', 'None'),
  P('Prithvi Shaw', 'India', 'IPL', 'BAT', 'M', 25, 'R', 'None'),
  P('Devdutt Padikkal', 'India', 'IPL', 'BAT', 'M', 24, 'L', 'None'),
  P('Rahul Tripathi', 'India', 'IPL', 'BAT', 'M', 34, 'R', 'None'),
  P('Jitesh Sharma', 'India', 'IPL', 'WK', 'M', 31, 'R', 'None'),
  P('Dhruv Jurel', 'India', 'IPL', 'WK', 'M', 24, 'R', 'None'),
  P('Prabhsimran Singh', 'India', 'IPL', 'WK', 'S', 24, 'R', 'None'),
  P('Shashank Singh', 'India', 'IPL', 'BAT', 'M', 33, 'R', 'Right-arm off-break'),
  P('Ashutosh Sharma', 'India', 'IPL', 'BAT', 'S', 26, 'R', 'None'),
  P('Nehal Wadhera', 'India', 'IPL', 'BAT', 'S', 24, 'L', 'None'),
  P('Ramandeep Singh', 'India', 'IPL', 'AR', 'S', 27, 'R', 'Right-arm medium'),
  P('Harpreet Brar', 'India', 'IPL', 'AR', 'S', 29, 'L', 'Left-arm orthodox'),
  P('Abishek Porel', 'India', 'IPL', 'WK', 'S', 22, 'L', 'None'),
  P('Ayush Badoni', 'India', 'IPL', 'BAT', 'S', 25, 'R', 'Right-arm off-break'),
  P('Naman Dhir', 'India', 'IPL', 'AR', 'S', 25, 'R', 'Right-arm off-break'),
  P('Angkrish Raghuvanshi', 'India', 'IPL', 'BAT', 'S', 20, 'R', 'None'),
  P('Vaibhav Suryavanshi', 'India', 'IPL', 'BAT', 'D', 16, 'L', 'None'),
  P('Priyansh Arya', 'India', 'IPL', 'BAT', 'S', 24, 'L', 'None'),
  P('Musheer Khan', 'India', 'IPL', 'AR', 'D', 20, 'R', 'Left-arm orthodox'),
  P('Sarfaraz Khan', 'India', 'IPL', 'BAT', 'M', 27, 'R', 'None'),
  P('Sameer Rizvi', 'India', 'IPL', 'BAT', 'D', 21, 'R', 'Right-arm off-break'),
  P('Kumar Kushagra', 'India', 'IPL', 'WK', 'D', 20, 'R', 'None'),
  P('Robin Minz', 'India', 'IPL', 'WK', 'D', 22, 'L', 'None'),
  P('Anshul Kamboj', 'India', 'IPL', 'BWL', 'S', 24, 'R', 'Right-arm medium-fast'),
  P('Akash Deep', 'India', 'IPL', 'BWL', 'M', 28, 'R', 'Right-arm fast-medium'),
  P('Yash Dayal', 'India', 'IPL', 'BWL', 'S', 27, 'L', 'Left-arm fast-medium'),
  P('Vijaykumar Vyshak', 'India', 'IPL', 'BWL', 'S', 28, 'R', 'Right-arm medium-fast'),
  P('Rasikh Salam', 'India', 'IPL', 'BWL', 'S', 24, 'R', 'Right-arm fast-medium'),
  P('Yash Thakur', 'India', 'IPL', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Tushar Deshpande', 'India', 'IPL', 'BWL', 'S', 29, 'L', 'Right-arm fast-medium'),
  P('Akash Madhwal', 'India', 'IPL', 'BWL', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Mohsin Khan', 'India', 'IPL', 'BWL', 'S', 26, 'L', 'Left-arm fast-medium'),
  P('Umran Malik', 'India', 'IPL', 'BWL', 'S', 25, 'R', 'Right-arm fast'),
  P('Kartik Tyagi', 'India', 'IPL', 'BWL', 'D', 24, 'R', 'Right-arm fast'),
  P('Shivam Mavi', 'India', 'IPL', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Chetan Sakariya', 'India', 'IPL', 'BWL', 'S', 27, 'L', 'Left-arm fast-medium'),
  P('Kamlesh Nagarkoti', 'India', 'IPL', 'BWL', 'D', 25, 'R', 'Right-arm fast'),
  P('Suyash Sharma', 'India', 'IPL', 'BWL', 'S', 21, 'R', 'Right-arm leg-break'),
  P('Digvesh Rathi', 'India', 'IPL', 'BWL', 'S', 25, 'R', 'Right-arm leg-break'),
  P('Vipraj Nigam', 'India', 'IPL', 'AR', 'S', 20, 'R', 'Right-arm leg-break'),
  P('Vignesh Puthur', 'India', 'IPL', 'BWL', 'D', 24, 'R', 'Left-arm wrist-spin'),
  P('Ashwani Kumar', 'India', 'IPL', 'BWL', 'D', 23, 'L', 'Left-arm fast-medium'),
  P('Vaibhav Arora', 'India', 'IPL', 'BWL', 'S', 27, 'R', 'Right-arm medium-fast'),
  P('Simarjeet Singh', 'India', 'IPL', 'BWL', 'S', 27, 'R', 'Right-arm fast-medium'),
  P('Manav Suthar', 'India', 'IPL', 'BWL', 'D', 22, 'L', 'Left-arm orthodox'),
  P('Shreyas Gopal', 'India', 'IPL', 'BWL', 'S', 31, 'R', 'Right-arm leg-break'),
  P('Mayank Markande', 'India', 'IPL', 'BWL', 'S', 27, 'R', 'Right-arm leg-break'),
  P('Karn Sharma', 'India', 'IPL', 'BWL', 'S', 37, 'L', 'Right-arm leg-break'),
  P('Murugan Ashwin', 'India', 'IPL', 'BWL', 'S', 34, 'R', 'Right-arm leg-break'),
  P('Swapnil Singh', 'India', 'IPL', 'AR', 'S', 34, 'R', 'Left-arm orthodox'),
  P('Vijay Shankar', 'India', 'IPL', 'AR', 'S', 34, 'R', 'Right-arm medium'),
  P('Abdul Samad', 'India', 'IPL', 'BAT', 'S', 23, 'R', 'Right-arm leg-break'),
  P('Anuj Rawat', 'India', 'IPL', 'WK', 'S', 25, 'L', 'None'),
  P('Shahrukh Khan', 'India', 'IPL', 'BAT', 'S', 29, 'R', 'Right-arm off-break'),
  P('Mahipal Lomror', 'India', 'IPL', 'AR', 'S', 25, 'L', 'Left-arm orthodox'),
  P('Suyash Prabhudessai', 'India', 'IPL', 'BAT', 'D', 27, 'R', 'None'),
  P('Manoj Bhandage', 'India', 'IPL', 'AR', 'D', 26, 'L', 'Right-arm medium'),
  P('Lalit Yadav', 'India', 'IPL', 'AR', 'S', 28, 'R', 'Right-arm off-break'),
  P('Prerak Mankad', 'India', 'IPL', 'AR', 'D', 30, 'R', 'Right-arm medium'),
  P('Arshin Kulkarni', 'India', 'IPL', 'AR', 'D', 20, 'R', 'Right-arm medium'),
  P('Raj Bawa', 'India', 'IPL', 'AR', 'D', 22, 'L', 'Right-arm medium-fast'),
  P('Yash Dhull', 'India', 'IPL', 'BAT', 'S', 22, 'R', 'None'),
  P('Shaik Rasheed', 'India', 'IPL', 'BAT', 'D', 20, 'R', 'None'),
  P('Nishant Sindhu', 'India', 'IPL', 'AR', 'D', 20, 'L', 'Left-arm orthodox'),
  P('Rajvardhan Hangargekar', 'India', 'IPL', 'AR', 'D', 22, 'R', 'Right-arm fast-medium'),
  P('Abhimanyu Easwaran', 'India', 'IPL', 'BAT', 'S', 29, 'R', 'None'),
  P('Mukesh Choudhary', 'India', 'IPL', 'BWL', 'S', 28, 'L', 'Left-arm fast-medium'),
  P('Navdeep Saini', 'India', 'IPL', 'BWL', 'S', 32, 'R', 'Right-arm fast'),
  P('Siddarth Kaul', 'India', 'IPL', 'BWL', 'S', 34, 'R', 'Right-arm fast-medium'),
  P('Basil Thampi', 'India', 'IPL', 'BWL', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Sandeep Warrier', 'India', 'IPL', 'BWL', 'S', 33, 'R', 'Right-arm fast-medium'),
  P('Varun Aaron', 'India', 'IPL', 'BWL', 'S', 35, 'R', 'Right-arm fast'),
  P('Dhawal Kulkarni', 'India', 'IPL', 'BWL', 'S', 36, 'R', 'Right-arm medium-fast'),
  P('Vinay Kumar', 'India', 'IPL', 'BWL', 'S', 38, 'R', 'Right-arm medium-fast'),
  P('Lakshmipathy Balaji', 'India', 'IPL', 'BWL', 'S', 37, 'R', 'Right-arm fast-medium'),
  P('Ashok Dinda', 'India', 'IPL', 'BWL', 'S', 36, 'R', 'Right-arm fast-medium'),
  P('S Sreesanth', 'India', 'IPL', 'BWL', 'M', 36, 'R', 'Right-arm fast'),
  P('Subramaniam Badrinath', 'India', 'IPL', 'BAT', 'S', 37, 'R', 'None'),
  P('Mandeep Singh', 'India', 'IPL', 'BAT', 'S', 33, 'R', 'None'),
  P('Gurkeerat Singh Mann', 'India', 'IPL', 'AR', 'S', 34, 'R', 'Right-arm off-break'),
  P('Hanuma Vihari', 'India', 'IPL', 'BAT', 'S', 31, 'R', 'Right-arm off-break'),
  P('Stuart Binny', 'India', 'IPL', 'AR', 'S', 38, 'R', 'Right-arm medium'),
  P('Rajat Bhatia', 'India', 'IPL', 'AR', 'S', 39, 'R', 'Right-arm medium'),
  P('Manpreet Gony', 'India', 'IPL', 'BWL', 'S', 38, 'R', 'Right-arm medium-fast'),
  P('Shadab Jakati', 'India', 'IPL', 'BWL', 'S', 38, 'L', 'Left-arm orthodox'),
  P('Iqbal Abdulla', 'India', 'IPL', 'BWL', 'S', 35, 'L', 'Left-arm orthodox'),
  P('Pawan Negi', 'India', 'IPL', 'AR', 'S', 32, 'L', 'Left-arm orthodox'),
  P('Naman Ojha', 'India', 'IPL', 'WK', 'S', 38, 'R', 'None'),
  P('Manvinder Bisla', 'India', 'IPL', 'WK', 'S', 38, 'R', 'None'),
  P('Dinesh Salunkhe', 'India', 'IPL', 'AR', 'D', 38, 'R', 'Right-arm leg-break'),
  P('Swapnil Asnodkar', 'India', 'IPL', 'BAT', 'D', 38, 'R', 'None'),
  P('Paul Valthaty', 'India', 'IPL', 'AR', 'S', 37, 'R', 'Right-arm medium'),
  P('Saurabh Tiwary', 'India', 'IPL', 'BAT', 'S', 35, 'L', 'None'),
  P('Manoj Tiwary', 'India', 'IPL', 'BAT', 'S', 38, 'R', 'Right-arm leg-break'),
  P('Abhinav Mukund', 'India', 'IPL', 'BAT', 'S', 35, 'L', 'None'),
  P('Wasim Jaffer', 'India', 'IPL', 'BAT', 'S', 40, 'R', 'None'),
  P('Mohammad Kaif', 'India', 'IPL', 'BAT', 'S', 38, 'R', 'None'),
  P('Ajit Agarkar', 'India', 'IPL', 'BWL', 'M', 38, 'R', 'Right-arm fast-medium'),
  P('Murali Kartik', 'India', 'IPL', 'BWL', 'S', 39, 'L', 'Left-arm orthodox'),
  P('Ramesh Powar', 'India', 'IPL', 'BWL', 'S', 39, 'R', 'Right-arm off-break'),
  P('Joginder Sharma', 'India', 'IPL', 'AR', 'S', 38, 'R', 'Right-arm medium'),
  P('Sridharan Sriram', 'India', 'IPL', 'AR', 'S', 40, 'L', 'Left-arm orthodox'),
  P('Venugopal Rao', 'India', 'IPL', 'BAT', 'S', 39, 'R', 'Right-arm off-break'),
  P('Tirumalasetti Suman', 'India', 'IPL', 'BAT', 'D', 38, 'R', 'Right-arm off-break'),
  P('Aditya Tare', 'India', 'IPL', 'WK', 'S', 37, 'R', 'None'),
  P('Shubham Dubey', 'India', 'IPL', 'BAT', 'S', 30, 'L', 'None'),
  P('Smaran Ravichandran', 'India', 'IPL', 'BAT', 'D', 21, 'L', 'None'),
  P('Ayush Mhatre', 'India', 'IPL', 'BAT', 'D', 17, 'R', 'None'),
  P('Urvil Patel', 'India', 'IPL', 'WK', 'D', 26, 'R', 'None'),
  P('Sheldon Jackson', 'India', 'IPL', 'WK', 'S', 38, 'R', 'None'),
  P('KS Bharat', 'India', 'IPL', 'WK', 'S', 31, 'R', 'None'),
  P('Narayan Jagadeesan', 'India', 'IPL', 'WK', 'S', 29, 'R', 'None'),
  P('Vishnu Vinod', 'India', 'IPL', 'WK', 'S', 31, 'R', 'None'),
  P('Upendra Yadav', 'India', 'IPL', 'WK', 'D', 28, 'R', 'None'),
  P('Baba Indrajith', 'India', 'IPL', 'BAT', 'S', 30, 'R', 'None'),
  P('Priyam Garg', 'India', 'IPL', 'BAT', 'S', 24, 'R', 'None'),
  P('Virat Singh', 'India', 'IPL', 'BAT', 'D', 27, 'L', 'None'),
  P('Anmolpreet Singh', 'India', 'IPL', 'BAT', 'S', 26, 'R', 'None'),
  P('Sanvir Singh', 'India', 'IPL', 'AR', 'D', 28, 'R', 'Right-arm medium'),
  P('Vivrant Sharma', 'India', 'IPL', 'AR', 'D', 25, 'L', 'Right-arm leg-break'),
  P('Shams Mulani', 'India', 'IPL', 'AR', 'S', 27, 'L', 'Left-arm orthodox'),
  P('Tanush Kotian', 'India', 'IPL', 'AR', 'S', 26, 'R', 'Right-arm off-break'),
  P('Suryansh Shedge', 'India', 'IPL', 'AR', 'D', 22, 'R', 'Right-arm medium-fast'),
  P('Harsh Dubey', 'India', 'IPL', 'AR', 'D', 22, 'L', 'Left-arm orthodox'),
  P('Kumar Kartikeya', 'India', 'IPL', 'BWL', 'S', 27, 'R', 'Left-arm wrist-spin'),
  P('Yudhvir Singh', 'India', 'IPL', 'BWL', 'S', 27, 'R', 'Right-arm fast-medium'),
  P('Kuldeep Sen', 'India', 'IPL', 'BWL', 'S', 28, 'R', 'Right-arm fast'),
  P('Kuldip Yadav', 'India', 'IPL', 'BWL', 'D', 28, 'L', 'Left-arm fast-medium'),
  P('Sushant Mishra', 'India', 'IPL', 'BWL', 'D', 24, 'L', 'Left-arm fast-medium'),
  P('Gurnoor Brar', 'India', 'IPL', 'BWL', 'D', 24, 'R', 'Right-arm fast-medium'),
  P('Sakib Hussain', 'India', 'IPL', 'BWL', 'D', 20, 'R', 'Right-arm fast-medium'),
  P('Prashant Solanki', 'India', 'IPL', 'BWL', 'D', 25, 'R', 'Right-arm leg-break'),
  P('Jalaj Saxena', 'India', 'IPL', 'AR', 'S', 38, 'R', 'Right-arm off-break'),
  P('Saurabh Kumar', 'India', 'IPL', 'AR', 'S', 31, 'L', 'Left-arm orthodox'),
  P('Rishi Dhawan', 'India', 'IPL', 'AR', 'S', 35, 'R', 'Right-arm medium-fast'),
  P('Aakash Chopra', 'India', 'IPL', 'BAT', 'S', 37, 'R', 'None'),
  P('Hemang Badani', 'India', 'IPL', 'BAT', 'S', 38, 'L', 'None'),
  P('Rohan Gavaskar', 'India', 'IPL', 'BAT', 'S', 38, 'L', 'Left-arm orthodox'),
  P('Shreevats Goswami', 'India', 'IPL', 'WK', 'S', 35, 'L', 'None'),
  P('Siddharth Trivedi', 'India', 'IPL', 'BWL', 'S', 37, 'R', 'Right-arm medium-fast'),
  P('Abhishek Jhunjhunwala', 'India', 'IPL', 'BAT', 'D', 37, 'R', 'Right-arm off-break'),
  P('Arun Karthik', 'India', 'IPL', 'WK', 'S', 37, 'R', 'None'),
  P('Anirudha Srikkanth', 'India', 'IPL', 'BAT', 'D', 36, 'R', 'None'),
  P('Mithun Manhas', 'India', 'IPL', 'BAT', 'S', 38, 'R', 'Right-arm off-break'),
  P('Unmukt Chand', 'India', 'IPL', 'BAT', 'S', 31, 'R', 'None'),
  P('Baba Aparajith', 'India', 'IPL', 'AR', 'S', 30, 'R', 'Right-arm off-break'),
  P('Sachin Baby', 'India', 'IPL', 'BAT', 'S', 36, 'L', 'Right-arm off-break'),
  P('Mohammed Azharuddeen', 'India', 'IPL', 'WK', 'S', 30, 'R', 'None'),
  P('Siddhesh Lad', 'India', 'IPL', 'BAT', 'S', 32, 'R', 'Right-arm off-break'),
  P('Pradeep Sangwan', 'India', 'IPL', 'BWL', 'S', 34, 'L', 'Left-arm fast-medium'),
  P('Parvinder Awana', 'India', 'IPL', 'BWL', 'S', 38, 'R', 'Right-arm fast-medium'),
  P('Hrithik Shokeen', 'India', 'IPL', 'AR', 'D', 24, 'R', 'Right-arm off-break'),
  P('Ricky Bhui', 'India', 'IPL', 'BAT', 'S', 28, 'R', 'Right-arm leg-break'),
  P('Tanmay Agarwal', 'India', 'IPL', 'BAT', 'S', 29, 'L', 'None'),
  P('Sreenath Aravind', 'India', 'IPL', 'BWL', 'S', 38, 'L', 'Left-arm medium-fast'),
  P('Abhimanyu Mithun', 'India', 'IPL', 'BWL', 'S', 35, 'R', 'Right-arm fast-medium'),
  P('K Gowtham', 'India', 'IPL', 'AR', 'S', 36, 'R', 'Right-arm off-break'),
  P('Jagadeesha Suchith', 'India', 'IPL', 'BWL', 'S', 31, 'L', 'Left-arm orthodox'),
  P('Pravin Dubey', 'India', 'IPL', 'BWL', 'D', 31, 'R', 'Right-arm leg-break'),
  P('Darshan Nalkande', 'India', 'IPL', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Manimaran Siddharth', 'India', 'IPL', 'BWL', 'D', 26, 'L', 'Left-arm orthodox'),
  P('KM Asif', 'India', 'IPL', 'BWL', 'D', 31, 'R', 'Right-arm fast-medium'),
  P('Arzan Nagwaswalla', 'India', 'IPL', 'BWL', 'D', 27, 'L', 'Left-arm fast-medium'),
  P('Ankit Rajpoot', 'India', 'IPL', 'BWL', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Ishwar Pandey', 'India', 'IPL', 'BWL', 'S', 35, 'R', 'Right-arm medium-fast'),
  P('Ishan Porel', 'India', 'IPL', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Prayas Ray Barman', 'India', 'IPL', 'BWL', 'D', 22, 'R', 'Right-arm leg-break'),
  P('Jayant Yadav', 'India', 'IPL', 'AR', 'S', 35, 'R', 'Right-arm off-break'),
  P('Zeeshan Ansari', 'India', 'IPL', 'BWL', 'D', 25, 'R', 'Right-arm leg-break'),
  P('Prince Yadav', 'India', 'IPL', 'BWL', 'D', 23, 'R', 'Right-arm medium-fast'),
  P('Atharva Taide', 'India', 'IPL', 'BAT', 'S', 24, 'L', 'Left-arm orthodox'),
  P('Mayank Dagar', 'India', 'IPL', 'AR', 'S', 28, 'R', 'Left-arm orthodox'),
  P('Aman Hakim Khan', 'India', 'IPL', 'AR', 'D', 28, 'R', 'Right-arm medium'),
  P('Lukman Meriwala', 'India', 'IPL', 'BWL', 'D', 33, 'L', 'Left-arm fast-medium'),
  P('Abhinav Manohar', 'India', 'IPL', 'BAT', 'S', 30, 'R', 'Right-arm leg-break'),
  P('Vidwath Kaverappa', 'India', 'IPL', 'BWL', 'D', 25, 'R', 'Right-arm fast-medium'),
  P('Akshay Wadkar', 'India', 'IPL', 'WK', 'S', 30, 'R', 'None'),
  P('Harvik Desai', 'India', 'IPL', 'WK', 'D', 25, 'R', 'None'),
  P('Luvnith Sisodia', 'India', 'IPL', 'WK', 'D', 25, 'L', 'None'),
  P('Parvez Rasool', 'India', 'IPL', 'AR', 'S', 36, 'R', 'Right-arm off-break'),

  // IPL Overseas Legends & Signed / Auctioned Players (2008–2026)
  P('Shane Warne', 'Australia', 'IPL', 'BWL', 'L', 39, 'R', 'Right-arm leg-break'),
  P('Shane Watson', 'Australia', 'IPL', 'AR', 'L', 37, 'R', 'Right-arm fast-medium'),
  P('Adam Gilchrist', 'Australia', 'IPL', 'WK', 'L', 38, 'L', 'None'),
  P('Matthew Hayden', 'Australia', 'IPL', 'BAT', 'L', 37, 'L', 'None'),
  P('Michael Hussey', 'Australia', 'IPL', 'BAT', 'L', 38, 'L', 'None'),
  P('Brett Lee', 'Australia', 'IPL', 'BWL', 'L', 35, 'R', 'Right-arm fast'),
  P('Mitchell Johnson', 'Australia', 'IPL', 'BWL', 'L', 35, 'L', 'Left-arm fast'),
  P('Shaun Marsh', 'Australia', 'IPL', 'BAT', 'M', 36, 'L', 'None'),
  P('Brad Hodge', 'Australia', 'IPL', 'BAT', 'M', 37, 'R', 'Right-arm off-break'),
  P('Aaron Finch', 'Australia', 'IPL', 'BAT', 'M', 35, 'R', 'None'),
  P('Chris Lynn', 'Australia', 'IPL', 'BAT', 'M', 34, 'R', 'None'),
  P('Andrew Tye', 'Australia', 'IPL', 'BWL', 'S', 38, 'R', 'Right-arm medium-fast'),
  P('James Faulkner', 'Australia', 'IPL', 'AR', 'M', 33, 'R', 'Left-arm fast-medium'),
  P('Nathan Coulter-Nile', 'Australia', 'IPL', 'BWL', 'S', 37, 'R', 'Right-arm fast'),
  P('Kane Richardson', 'Australia', 'IPL', 'BWL', 'S', 34, 'R', 'Right-arm fast-medium'),
  P('Dan Christian', 'Australia', 'IPL', 'AR', 'S', 39, 'R', 'Right-arm medium-fast'),
  P('Moises Henriques', 'Australia', 'IPL', 'AR', 'S', 38, 'R', 'Right-arm medium-fast'),
  P('Ben Cutting', 'Australia', 'IPL', 'AR', 'S', 38, 'R', 'Right-arm fast-medium'),
  P('Andrew Symonds', 'Australia', 'IPL', 'AR', 'M', 35, 'R', 'Right-arm medium'),
  P('Ricky Ponting', 'Australia', 'IPL', 'BAT', 'L', 38, 'R', 'None'),
  P('Glenn McGrath', 'Australia', 'IPL', 'BWL', 'L', 38, 'R', 'Right-arm fast-medium'),
  P('Doug Bollinger', 'Australia', 'IPL', 'BWL', 'M', 34, 'L', 'Left-arm fast-medium'),
  P('Dirk Nannes', 'Australia', 'IPL', 'BWL', 'S', 36, 'L', 'Left-arm fast'),
  P('Riley Meredith', 'Australia', 'IPL', 'BWL', 'S', 28, 'R', 'Right-arm fast'),
  P('Jhye Richardson', 'Australia', 'IPL', 'BWL', 'M', 28, 'R', 'Right-arm fast'),
  P('Kieron Pollard', 'West Indies', 'IPL', 'AR', 'L', 37, 'R', 'Right-arm medium'),
  P('Dwayne Bravo', 'West Indies', 'IPL', 'AR', 'L', 39, 'R', 'Right-arm medium-fast'),
  P('Dwayne Smith', 'West Indies', 'IPL', 'AR', 'M', 35, 'R', 'Right-arm medium'),
  P('Lendl Simmons', 'West Indies', 'IPL', 'BAT', 'M', 35, 'R', 'None'),
  P('Darren Bravo', 'West Indies', 'IPL', 'BAT', 'S', 36, 'L', 'None'),
  P('Carlos Brathwaite', 'West Indies', 'IPL', 'AR', 'S', 36, 'R', 'Right-arm medium-fast'),
  P('Jason Holder', 'West Indies', 'IPL', 'AR', 'M', 33, 'R', 'Right-arm fast-medium'),
  P('Alzarri Joseph', 'West Indies', 'IPL', 'BWL', 'M', 28, 'R', 'Right-arm fast'),
  P('Shamar Joseph', 'West Indies', 'IPL', 'BWL', 'M', 25, 'L', 'Right-arm fast'),
  P('Romario Shepherd', 'West Indies', 'IPL', 'AR', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Sherfane Rutherford', 'West Indies', 'IPL', 'BAT', 'S', 26, 'L', 'None'),
  P('Kyle Mayers', 'West Indies', 'IPL', 'AR', 'S', 32, 'L', 'Right-arm medium'),
  P('Evin Lewis', 'West Indies', 'IPL', 'BAT', 'S', 33, 'L', 'None'),
  P('Odean Smith', 'West Indies', 'IPL', 'AR', 'S', 28, 'R', 'Right-arm fast'),
  P('Samuel Badree', 'West Indies', 'IPL', 'BWL', 'M', 36, 'R', 'Right-arm leg-break'),
  P('Ravi Rampaul', 'West Indies', 'IPL', 'BWL', 'S', 34, 'R', 'Right-arm fast-medium'),
  P('Graeme Smith', 'South Africa', 'IPL', 'BAT', 'M', 34, 'L', 'None'),
  P('Jacques Kallis', 'South Africa', 'IPL', 'AR', 'L', 38, 'R', 'Right-arm fast-medium'),
  P('Dale Steyn', 'South Africa', 'IPL', 'BWL', 'L', 36, 'R', 'Right-arm fast'),
  P('Morne Morkel', 'South Africa', 'IPL', 'BWL', 'M', 34, 'L', 'Right-arm fast'),
  P('Albie Morkel', 'South Africa', 'IPL', 'AR', 'M', 36, 'L', 'Right-arm medium-fast'),
  P('Imran Tahir', 'South Africa', 'IPL', 'BWL', 'L', 40, 'R', 'Right-arm leg-break'),
  P('JP Duminy', 'South Africa', 'IPL', 'AR', 'M', 35, 'L', 'Right-arm off-break'),
  P('Hashim Amla', 'South Africa', 'IPL', 'BAT', 'L', 36, 'R', 'None'),
  P('Chris Morris', 'South Africa', 'IPL', 'AR', 'M', 35, 'R', 'Right-arm fast-medium'),
  P('Anrich Nortje', 'South Africa', 'IPL', 'BWL', 'M', 31, 'R', 'Right-arm fast'),
  P('Lungi Ngidi', 'South Africa', 'IPL', 'BWL', 'M', 28, 'R', 'Right-arm fast'),
  P('Gerald Coetzee', 'South Africa', 'IPL', 'BWL', 'M', 24, 'R', 'Right-arm fast'),
  P('Rilee Rossouw', 'South Africa', 'IPL', 'BAT', 'S', 35, 'L', 'None'),
  P('Dewald Brevis', 'South Africa', 'IPL', 'BAT', 'S', 21, 'R', 'Right-arm leg-break'),
  P('Ryan Rickelton', 'South Africa', 'IPL', 'WK', 'M', 28, 'L', 'None'),
  P('Donovan Ferreira', 'South Africa', 'IPL', 'WK', 'S', 26, 'R', 'Right-arm off-break'),
  P('Kwena Maphaka', 'South Africa', 'IPL', 'BWL', 'D', 18, 'L', 'Left-arm fast'),
  P('Shaun Pollock', 'South Africa', 'IPL', 'AR', 'L', 35, 'R', 'Right-arm fast-medium'),
  P('Herschelle Gibbs', 'South Africa', 'IPL', 'BAT', 'M', 36, 'R', 'None'),
  P('Makhaya Ntini', 'South Africa', 'IPL', 'BWL', 'M', 34, 'R', 'Right-arm fast'),
  P('Kevin Pietersen', 'England', 'IPL', 'BAT', 'L', 35, 'R', 'Right-arm off-break'),
  P('Eoin Morgan', 'England', 'IPL', 'BAT', 'M', 35, 'L', 'None'),
  P('Ben Stokes', 'England', 'IPL', 'AR', 'L', 33, 'L', 'Right-arm fast-medium'),
  P('Moeen Ali', 'England', 'IPL', 'AR', 'M', 37, 'L', 'Right-arm off-break'),
  P('Jonny Bairstow', 'England', 'IPL', 'WK', 'M', 35, 'R', 'None'),
  P('Jason Roy', 'England', 'IPL', 'BAT', 'M', 34, 'R', 'None'),
  P('Will Jacks', 'England', 'IPL', 'AR', 'M', 26, 'R', 'Right-arm off-break'),
  P('Jacob Bethell', 'England', 'IPL', 'AR', 'S', 21, 'L', 'Left-arm orthodox'),
  P('Harry Brook', 'England', 'IPL', 'BAT', 'L', 26, 'R', 'None'),
  P('Mark Wood', 'England', 'IPL', 'BWL', 'L', 35, 'R', 'Right-arm fast'),
  P('Reece Topley', 'England', 'IPL', 'BWL', 'S', 31, 'R', 'Left-arm fast-medium'),
  P('Adil Rashid', 'England', 'IPL', 'BWL', 'L', 37, 'R', 'Right-arm leg-break'),
  P('Tymal Mills', 'England', 'IPL', 'BWL', 'S', 32, 'R', 'Left-arm fast'),
  P('Chris Jordan', 'England', 'IPL', 'BWL', 'S', 36, 'R', 'Right-arm fast-medium'),
  P('Tom Curran', 'England', 'IPL', 'AR', 'S', 29, 'R', 'Right-arm medium-fast'),
  P('Brendon McCullum', 'New Zealand', 'IPL', 'WK', 'L', 36, 'R', 'None'),
  P('Ross Taylor', 'New Zealand', 'IPL', 'BAT', 'L', 37, 'R', 'None'),
  P('Kane Williamson', 'New Zealand', 'IPL', 'BAT', 'L', 34, 'R', 'Right-arm off-break'),
  P('Daniel Vettori', 'New Zealand', 'IPL', 'BWL', 'M', 36, 'L', 'Left-arm orthodox'),
  P('Tim Southee', 'New Zealand', 'IPL', 'BWL', 'M', 36, 'R', 'Right-arm fast-medium'),
  P('Matt Henry', 'New Zealand', 'IPL', 'BWL', 'M', 33, 'R', 'Right-arm fast-medium'),
  P('Glenn Phillips', 'New Zealand', 'IPL', 'AR', 'M', 28, 'R', 'Right-arm off-break'),
  P('Finn Allen', 'New Zealand', 'IPL', 'BAT', 'S', 25, 'R', 'None'),
  P('Martin Guptill', 'New Zealand', 'IPL', 'BAT', 'M', 37, 'R', 'None'),
  P('Colin de Grandhomme', 'New Zealand', 'IPL', 'AR', 'S', 37, 'R', 'Right-arm medium'),
  P('Jimmy Neesham', 'New Zealand', 'IPL', 'AR', 'S', 34, 'L', 'Right-arm medium-fast'),
  P('Shane Bond', 'New Zealand', 'IPL', 'BWL', 'L', 34, 'R', 'Right-arm fast'),
  P('Sanath Jayasuriya', 'Sri Lanka', 'IPL', 'AR', 'L', 39, 'L', 'Left-arm orthodox'),
  P('Kumar Sangakkara', 'Sri Lanka', 'IPL', 'WK', 'L', 38, 'L', 'None'),
  P('Mahela Jayawardene', 'Sri Lanka', 'IPL', 'BAT', 'L', 37, 'R', 'None'),
  P('Tillakaratne Dilshan', 'Sri Lanka', 'IPL', 'BAT', 'M', 38, 'R', 'Right-arm off-break'),
  P('Muttiah Muralitharan', 'Sri Lanka', 'IPL', 'BWL', 'L', 40, 'R', 'Right-arm off-break'),
  P('Lasith Malinga', 'Sri Lanka', 'IPL', 'BWL', 'L', 37, 'R', 'Right-arm fast'),
  P('Angelo Mathews', 'Sri Lanka', 'IPL', 'AR', 'M', 37, 'R', 'Right-arm medium'),
  P('Thisara Perera', 'Sri Lanka', 'IPL', 'AR', 'S', 35, 'L', 'Right-arm medium-fast'),
  P('Dushmantha Chameera', 'Sri Lanka', 'IPL', 'BWL', 'S', 33, 'R', 'Right-arm fast'),
  P('Nuwan Thushara', 'Sri Lanka', 'IPL', 'BWL', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Kusal Mendis', 'Sri Lanka', 'IPL', 'WK', 'M', 30, 'R', 'None'),
  P('Kamindu Mendis', 'Sri Lanka', 'IPL', 'AR', 'M', 26, 'L', 'Right-arm off-break'),
  P('Shahid Afridi', 'Pakistan', 'PSL', 'AR', 'L', 38, 'R', 'Right-arm leg-break'),
  P('Shoaib Akhtar', 'Pakistan', 'International', 'BWL', 'L', 35, 'R', 'Right-arm fast'),
  P('Sohail Tanvir', 'Pakistan', 'PSL', 'BWL', 'M', 36, 'L', 'Left-arm medium-fast'),
  P('Umar Gul', 'Pakistan', 'PSL', 'BWL', 'M', 36, 'R', 'Right-arm fast-medium'),
  P('Azhar Mahmood', 'Pakistan', 'PSL', 'AR', 'M', 39, 'R', 'Right-arm fast-medium'),
  P('Misbah-ul-Haq', 'Pakistan', 'PSL', 'BAT', 'L', 40, 'R', 'None'),
  P('Younis Khan', 'Pakistan', 'International', 'BAT', 'L', 37, 'R', 'None'),
  P('Shakib Al Hasan', 'Bangladesh', 'IPL', 'AR', 'L', 37, 'L', 'Left-arm orthodox'),
  P('Mashrafe Mortaza', 'Bangladesh', 'IPL', 'BWL', 'S', 36, 'R', 'Right-arm fast-medium'),
  P('Mohammad Nabi', 'Afghanistan', 'IPL', 'AR', 'M', 40, 'R', 'Right-arm off-break'),
  P('Mujeeb Ur Rahman', 'Afghanistan', 'IPL', 'BWL', 'S', 23, 'R', 'Right-arm off-break'),
  P('Naveen-ul-Haq', 'Afghanistan', 'IPL', 'BWL', 'M', 25, 'R', 'Right-arm fast-medium'),
  P('Allah Ghazanfar', 'Afghanistan', 'IPL', 'BWL', 'D', 18, 'R', 'Right-arm off-break'),
  P('Jake Fraser-McGurk', 'Australia', 'IPL', 'BAT', 'M', 22, 'R', 'None'),
  P('Spencer Johnson', 'Australia', 'IPL', 'BWL', 'S', 29, 'L', 'Left-arm fast'),
  P('Nathan Ellis', 'Australia', 'IPL', 'BWL', 'M', 30, 'R', 'Right-arm fast-medium'),
  P('Xavier Bartlett', 'Australia', 'IPL', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Aaron Hardie', 'Australia', 'IPL', 'AR', 'S', 26, 'R', 'Right-arm medium-fast'),
  P('Josh Inglis', 'Australia', 'IPL', 'WK', 'M', 29, 'R', 'None'),
  P('Matthew Short', 'Australia', 'IPL', 'AR', 'S', 29, 'R', 'Right-arm off-break'),
  P('Cooper Connolly', 'Australia', 'IPL', 'AR', 'D', 21, 'L', 'Left-arm orthodox'),
  P('Sikandar Raza', 'Zimbabwe', 'IPL', 'AR', 'M', 38, 'R', 'Right-arm off-break'),
  P('Sam Billings', 'England', 'IPL', 'WK', 'S', 33, 'R', 'None'),
  P('Tom Banton', 'England', 'IPL', 'WK', 'S', 26, 'R', 'None'),
  P('David Willey', 'England', 'IPL', 'AR', 'S', 34, 'L', 'Left-arm fast-medium'),
  P('Chris Woakes', 'England', 'IPL', 'AR', 'M', 36, 'R', 'Right-arm fast-medium'),
  P('Gus Atkinson', 'England', 'IPL', 'BWL', 'M', 27, 'R', 'Right-arm fast'),
  P('Jamie Overton', 'England', 'IPL', 'AR', 'S', 30, 'R', 'Right-arm fast'),
  P('Brydon Carse', 'England', 'IPL', 'BWL', 'M', 29, 'R', 'Right-arm fast'),
  P('Shoaib Bashir', 'England', 'International', 'BWL', 'S', 21, 'R', 'Right-arm off-break'),

  // ================= INTERNATIONAL FULL MEMBERS =================
  // Australia Test & White-Ball Core
  P('Steve Smith', 'Australia', 'International', 'BAT', 'L', 35, 'R', 'Right-arm leg-break'),
  P('Marnus Labuschagne', 'Australia', 'International', 'BAT', 'L', 30, 'R', 'Right-arm leg-break'),
  P('Usman Khawaja', 'Australia', 'International', 'BAT', 'L', 38, 'L', 'None'),
  P('Alex Carey', 'Australia', 'International', 'WK', 'M', 33, 'L', 'None'),
  P('Nathan Lyon', 'Australia', 'International', 'BWL', 'L', 37, 'R', 'Right-arm off-break'),
  P('Scott Boland', 'Australia', 'International', 'BWL', 'M', 35, 'R', 'Right-arm fast-medium'),
  P('Beau Webster', 'Australia', 'International', 'AR', 'S', 31, 'R', 'Right-arm medium'),
  P('Sam Konstas', 'Australia', 'International', 'BAT', 'S', 19, 'R', 'None'),
  P('Nathan McSweeney', 'Australia', 'International', 'BAT', 'S', 25, 'R', 'Right-arm off-break'),
  P('Adam Zampa', 'Australia', 'International', 'BWL', 'L', 32, 'R', 'Right-arm leg-break'),
  P('Sean Abbott', 'Australia', 'International', 'AR', 'S', 33, 'R', 'Right-arm fast-medium'),
  P('Lance Morris', 'Australia', 'International', 'BWL', 'S', 26, 'R', 'Right-arm fast'),
  P('Tanveer Sangha', 'Australia', 'International', 'BWL', 'S', 23, 'R', 'Right-arm leg-break'),
  P('Todd Murphy', 'Australia', 'International', 'BWL', 'S', 24, 'R', 'Right-arm off-break'),
  P('Matthew Kuhnemann', 'Australia', 'International', 'BWL', 'S', 28, 'L', 'Left-arm orthodox'),
  P('Marcus Harris', 'Australia', 'International', 'BAT', 'S', 32, 'L', 'None'),
  P('Matt Renshaw', 'Australia', 'International', 'BAT', 'S', 28, 'L', 'None'),
  P('Peter Handscomb', 'Australia', 'International', 'WK', 'S', 33, 'R', 'None'),
  P('Michael Neser', 'Australia', 'International', 'AR', 'S', 34, 'R', 'Right-arm medium-fast'),

  // England International Core
  P('Joe Root', 'England', 'International', 'BAT', 'L', 34, 'R', 'Right-arm off-break'),
  P('Zak Crawley', 'England', 'International', 'BAT', 'M', 27, 'R', 'None'),
  P('Ben Duckett', 'England', 'International', 'BAT', 'M', 30, 'L', 'None'),
  P('Ollie Pope', 'England', 'International', 'BAT', 'M', 27, 'R', 'None'),
  P('Jamie Smith', 'England', 'International', 'WK', 'M', 24, 'R', 'None'),
  P('James Anderson', 'England', 'International', 'BWL', 'L', 42, 'L', 'Right-arm fast-medium'),
  P('Stuart Broad', 'England', 'International', 'BWL', 'L', 38, 'L', 'Right-arm fast-medium'),
  P('Jack Leach', 'England', 'International', 'BWL', 'S', 33, 'L', 'Left-arm orthodox'),
  P('Matthew Potts', 'England', 'International', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Josh Tongue', 'England', 'International', 'BWL', 'S', 27, 'R', 'Right-arm fast-medium'),
  P('Ollie Robinson', 'England', 'International', 'BWL', 'M', 31, 'R', 'Right-arm medium-fast'),
  P('Saqib Mahmood', 'England', 'International', 'BWL', 'S', 28, 'R', 'Right-arm fast'),
  P('Rehan Ahmed', 'England', 'International', 'AR', 'S', 20, 'R', 'Right-arm leg-break'),
  P('Tom Hartley', 'England', 'International', 'BWL', 'S', 25, 'L', 'Left-arm orthodox'),
  P('Alastair Cook', 'England', 'International', 'BAT', 'L', 39, 'L', 'None'),
  P('Graeme Swann', 'England', 'International', 'BWL', 'L', 37, 'R', 'Right-arm off-break'),

  // South Africa International
  P('Temba Bavuma', 'South Africa', 'International', 'BAT', 'M', 34, 'R', 'None'),
  P('Tony de Zorzi', 'South Africa', 'International', 'BAT', 'S', 27, 'L', 'None'),
  P('Kyle Verreynne', 'South Africa', 'International', 'WK', 'S', 27, 'R', 'None'),
  P('Keshav Maharaj', 'South Africa', 'International', 'BWL', 'L', 35, 'R', 'Left-arm orthodox'),
  P('Tabraiz Shamsi', 'South Africa', 'International', 'BWL', 'M', 34, 'R', 'Left-arm wrist-spin'),
  P('Rassie van der Dussen', 'South Africa', 'International', 'BAT', 'M', 36, 'R', 'None'),
  P('Reeza Hendricks', 'South Africa', 'International', 'BAT', 'S', 35, 'R', 'None'),
  P('Wiaan Mulder', 'South Africa', 'International', 'AR', 'S', 27, 'R', 'Right-arm medium'),
  P('Nandre Burger', 'South Africa', 'International', 'BWL', 'S', 29, 'L', 'Left-arm fast'),
  P('Corbin Bosch', 'South Africa', 'International', 'AR', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Matthew Breetzke', 'South Africa', 'International', 'BAT', 'S', 26, 'R', 'None'),
  P('David Bedingham', 'South Africa', 'International', 'BAT', 'S', 30, 'R', 'None'),
  P('Dane Paterson', 'South Africa', 'International', 'BWL', 'S', 35, 'R', 'Right-arm medium-fast'),
  P('Senuran Muthusamy', 'South Africa', 'International', 'AR', 'S', 31, 'L', 'Left-arm orthodox'),
  P('Ottneil Baartman', 'South Africa', 'International', 'BWL', 'M', 31, 'R', 'Right-arm medium-fast'),
  P('Bjorn Fortuin', 'South Africa', 'International', 'BWL', 'S', 30, 'R', 'Left-arm orthodox'),
  P('Andile Phehlukwayo', 'South Africa', 'International', 'AR', 'S', 28, 'L', 'Right-arm fast-medium'),
  P('Zubayr Hamza', 'South Africa', 'International', 'BAT', 'S', 29, 'R', 'None'),

  // New Zealand International
  P('Tom Latham', 'New Zealand', 'International', 'WK', 'M', 32, 'L', 'None'),
  P('Will Young', 'New Zealand', 'International', 'BAT', 'M', 32, 'R', 'None'),
  P('Tom Blundell', 'New Zealand', 'International', 'WK', 'S', 34, 'R', 'None'),
  P('Kyle Jamieson', 'New Zealand', 'International', 'BWL', 'M', 30, 'R', 'Right-arm fast-medium'),
  P("Will O'Rourke", 'New Zealand', 'International', 'BWL', 'M', 23, 'R', 'Right-arm fast'),
  P('Ajaz Patel', 'New Zealand', 'International', 'BWL', 'S', 36, 'L', 'Left-arm orthodox'),
  P('Ish Sodhi', 'New Zealand', 'International', 'BWL', 'M', 32, 'R', 'Right-arm leg-break'),
  P('Michael Bracewell', 'New Zealand', 'International', 'AR', 'M', 34, 'L', 'Right-arm off-break'),
  P('Mark Chapman', 'New Zealand', 'International', 'BAT', 'S', 30, 'L', 'Left-arm orthodox'),
  P('Tim Seifert', 'New Zealand', 'International', 'WK', 'S', 30, 'R', 'None'),
  P('Jacob Duffy', 'New Zealand', 'International', 'BWL', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Ben Sears', 'New Zealand', 'International', 'BWL', 'S', 27, 'R', 'Right-arm fast'),
  P('Nathan Smith', 'New Zealand', 'International', 'AR', 'S', 26, 'R', 'Right-arm medium-fast'),
  P('Henry Nicholls', 'New Zealand', 'International', 'BAT', 'S', 33, 'L', 'None'),
  P('Colin Munro', 'New Zealand', 'International', 'BAT', 'M', 37, 'L', 'None'),
  P('Adam Milne', 'New Zealand', 'International', 'BWL', 'M', 32, 'R', 'Right-arm fast'),
  P('Neil Wagner', 'New Zealand', 'International', 'BWL', 'M', 38, 'L', 'Left-arm fast-medium'),
  P('Mitch Hay', 'New Zealand', 'International', 'WK', 'S', 24, 'R', 'None'),

  // Pakistan International
  P('Babar Azam', 'Pakistan', 'International', 'BAT', 'L', 30, 'R', 'None'),
  P('Mohammad Rizwan', 'Pakistan', 'International', 'WK', 'L', 32, 'R', 'None'),
  P('Shaheen Shah Afridi', 'Pakistan', 'International', 'BWL', 'L', 24, 'L', 'Left-arm fast'),
  P('Naseem Shah', 'Pakistan', 'International', 'BWL', 'M', 22, 'R', 'Right-arm fast'),
  P('Haris Rauf', 'Pakistan', 'International', 'BWL', 'M', 31, 'R', 'Right-arm fast'),
  P('Fakhar Zaman', 'Pakistan', 'International', 'BAT', 'M', 34, 'L', 'None'),
  P('Saim Ayub', 'Pakistan', 'International', 'BAT', 'M', 22, 'L', 'Right-arm off-break'),
  P('Salman Ali Agha', 'Pakistan', 'International', 'AR', 'M', 31, 'R', 'Right-arm off-break'),
  P('Saud Shakeel', 'Pakistan', 'International', 'BAT', 'M', 29, 'L', 'Left-arm orthodox'),
  P('Shan Masood', 'Pakistan', 'International', 'BAT', 'M', 35, 'L', 'None'),
  P('Abdullah Shafique', 'Pakistan', 'International', 'BAT', 'M', 25, 'R', 'None'),
  P('Shadab Khan', 'Pakistan', 'International', 'AR', 'M', 26, 'R', 'Right-arm leg-break'),
  P('Abrar Ahmed', 'Pakistan', 'International', 'BWL', 'M', 26, 'R', 'Right-arm leg-break'),
  P('Noman Ali', 'Pakistan', 'International', 'BWL', 'M', 38, 'L', 'Left-arm orthodox'),
  P('Sajid Khan', 'Pakistan', 'International', 'BWL', 'M', 31, 'R', 'Right-arm off-break'),
  P('Iftikhar Ahmed', 'Pakistan', 'International', 'AR', 'S', 34, 'R', 'Right-arm off-break'),
  P('Mohammad Nawaz', 'Pakistan', 'International', 'AR', 'S', 30, 'L', 'Left-arm orthodox'),
  P('Imam-ul-Haq', 'Pakistan', 'International', 'BAT', 'S', 29, 'L', 'None'),
  P('Sarfaraz Ahmed', 'Pakistan', 'International', 'WK', 'S', 37, 'R', 'None'),
  P('Mohammad Amir', 'Pakistan', 'International', 'BWL', 'M', 32, 'L', 'Left-arm fast'),
  P('Imad Wasim', 'Pakistan', 'International', 'AR', 'M', 36, 'L', 'Left-arm orthodox'),
  P('Khurram Shahzad', 'Pakistan', 'International', 'BWL', 'S', 25, 'R', 'Right-arm medium-fast'),
  P('Aamer Jamal', 'Pakistan', 'International', 'AR', 'S', 28, 'R', 'Right-arm fast-medium'),
  P('Usama Mir', 'Pakistan', 'International', 'BWL', 'S', 29, 'R', 'Right-arm leg-break'),
  P('Hasan Ali', 'Pakistan', 'International', 'BWL', 'M', 30, 'R', 'Right-arm fast-medium'),
  P('Mohammad Wasim', 'Pakistan', 'International', 'BWL', 'S', 23, 'R', 'Right-arm fast-medium'),

  // Sri Lanka International
  P('Pathum Nissanka', 'Sri Lanka', 'International', 'BAT', 'M', 26, 'R', 'None'),
  P('Charith Asalanka', 'Sri Lanka', 'International', 'BAT', 'M', 27, 'L', 'Right-arm off-break'),
  P('Dimuth Karunaratne', 'Sri Lanka', 'International', 'BAT', 'M', 36, 'L', 'None'),
  P('Dinesh Chandimal', 'Sri Lanka', 'International', 'WK', 'M', 35, 'R', 'None'),
  P('Dhananjaya de Silva', 'Sri Lanka', 'International', 'AR', 'M', 33, 'R', 'Right-arm off-break'),
  P('Prabath Jayasuriya', 'Sri Lanka', 'International', 'BWL', 'M', 33, 'R', 'Left-arm orthodox'),
  P('Asitha Fernando', 'Sri Lanka', 'International', 'BWL', 'M', 27, 'R', 'Right-arm fast-medium'),
  P('Kasun Rajitha', 'Sri Lanka', 'International', 'BWL', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Lahiru Kumara', 'Sri Lanka', 'International', 'BWL', 'S', 28, 'L', 'Right-arm fast'),
  P('Dunith Wellalage', 'Sri Lanka', 'International', 'AR', 'S', 22, 'L', 'Left-arm orthodox'),
  P('Dasun Shanaka', 'Sri Lanka', 'International', 'AR', 'S', 33, 'R', 'Right-arm medium'),
  P('Kusal Perera', 'Sri Lanka', 'International', 'WK', 'S', 34, 'L', 'None'),
  P('Avishka Fernando', 'Sri Lanka', 'International', 'BAT', 'S', 26, 'R', 'None'),
  P('Sadeera Samarawickrama', 'Sri Lanka', 'International', 'WK', 'S', 29, 'R', 'None'),
  P('Milan Rathnayake', 'Sri Lanka', 'International', 'AR', 'D', 28, 'L', 'Right-arm fast-medium'),
  P('Jeffrey Vandersay', 'Sri Lanka', 'International', 'BWL', 'S', 35, 'R', 'Right-arm leg-break'),
  P('Dilshan Madushanka', 'Sri Lanka', 'International', 'BWL', 'S', 24, 'L', 'Left-arm fast-medium'),
  P('Ramesh Mendis', 'Sri Lanka', 'International', 'AR', 'S', 29, 'R', 'Right-arm off-break'),

  // West Indies International
  P('Shai Hope', 'West Indies', 'International', 'WK', 'M', 31, 'R', 'None'),
  P('Kraigg Brathwaite', 'West Indies', 'International', 'BAT', 'M', 32, 'R', 'Right-arm off-break'),
  P('Brandon King', 'West Indies', 'International', 'BAT', 'S', 30, 'R', 'None'),
  P('Johnson Charles', 'West Indies', 'International', 'WK', 'S', 36, 'R', 'None'),
  P('Roston Chase', 'West Indies', 'International', 'AR', 'S', 32, 'R', 'Right-arm off-break'),
  P('Gudakesh Motie', 'West Indies', 'International', 'BWL', 'M', 29, 'L', 'Left-arm orthodox'),
  P('Akeal Hosein', 'West Indies', 'International', 'BWL', 'M', 31, 'L', 'Left-arm orthodox'),
  P('Kemar Roach', 'West Indies', 'International', 'BWL', 'M', 36, 'R', 'Right-arm fast-medium'),
  P('Jayden Seales', 'West Indies', 'International', 'BWL', 'M', 23, 'L', 'Right-arm fast-medium'),
  P('Joshua Da Silva', 'West Indies', 'International', 'WK', 'S', 26, 'R', 'None'),
  P('Alick Athanaze', 'West Indies', 'International', 'BAT', 'S', 26, 'L', 'Right-arm off-break'),
  P('Kavem Hodge', 'West Indies', 'International', 'BAT', 'S', 32, 'R', 'Left-arm orthodox'),
  P('Mikyle Louis', 'West Indies', 'International', 'BAT', 'D', 24, 'R', 'None'),
  P('Obed McCoy', 'West Indies', 'International', 'BWL', 'S', 28, 'L', 'Left-arm fast-medium'),
  P('Tagenarine Chanderpaul', 'West Indies', 'International', 'BAT', 'S', 28, 'L', 'None'),
  P('Keacy Carty', 'West Indies', 'International', 'BAT', 'S', 27, 'R', 'None'),
  P('Justin Greaves', 'West Indies', 'International', 'AR', 'S', 30, 'R', 'Right-arm medium-fast'),
  P('Matthew Forde', 'West Indies', 'International', 'AR', 'S', 22, 'R', 'Right-arm fast-medium'),
  P('Jomel Warrican', 'West Indies', 'International', 'BWL', 'S', 32, 'L', 'Left-arm orthodox'),
  P('Oshane Thomas', 'West Indies', 'International', 'BWL', 'S', 28, 'R', 'Right-arm fast'),

  // Bangladesh International
  P('Litton Das', 'Bangladesh', 'International', 'WK', 'M', 30, 'R', 'None'),
  P('Mushfiqur Rahim', 'Bangladesh', 'International', 'WK', 'M', 37, 'R', 'None'),
  P('Mahmudullah', 'Bangladesh', 'International', 'AR', 'S', 39, 'R', 'Right-arm off-break'),
  P('Tamim Iqbal', 'Bangladesh', 'International', 'BAT', 'M', 35, 'L', 'None'),
  P('Najmul Hossain Shanto', 'Bangladesh', 'International', 'BAT', 'M', 26, 'L', 'None'),
  P('Mehidy Hasan Miraz', 'Bangladesh', 'International', 'AR', 'M', 27, 'R', 'Right-arm off-break'),
  P('Taskin Ahmed', 'Bangladesh', 'International', 'BWL', 'M', 29, 'L', 'Right-arm fast'),
  P('Shoriful Islam', 'Bangladesh', 'International', 'BWL', 'S', 23, 'L', 'Left-arm fast-medium'),
  P('Tanzid Hasan', 'Bangladesh', 'International', 'BAT', 'S', 24, 'L', 'None'),
  P('Towhid Hridoy', 'Bangladesh', 'International', 'BAT', 'S', 24, 'R', 'None'),
  P('Jaker Ali', 'Bangladesh', 'International', 'WK', 'S', 27, 'R', 'None'),
  P('Taijul Islam', 'Bangladesh', 'International', 'BWL', 'M', 33, 'L', 'Left-arm orthodox'),
  P('Hasan Mahmud', 'Bangladesh', 'International', 'BWL', 'S', 25, 'R', 'Right-arm fast-medium'),
  P('Nahid Rana', 'Bangladesh', 'International', 'BWL', 'S', 22, 'R', 'Right-arm fast'),
  P('Rishad Hossain', 'Bangladesh', 'International', 'BWL', 'S', 22, 'R', 'Right-arm leg-break'),
  P('Tanzim Hasan Sakib', 'Bangladesh', 'International', 'BWL', 'S', 22, 'R', 'Right-arm fast-medium'),
  P('Mahedi Hasan', 'Bangladesh', 'International', 'AR', 'S', 30, 'R', 'Right-arm off-break'),
  P('Soumya Sarkar', 'Bangladesh', 'International', 'AR', 'S', 32, 'L', 'Right-arm medium'),
  P('Mominul Haque', 'Bangladesh', 'International', 'BAT', 'S', 33, 'L', 'Left-arm orthodox'),

  // Afghanistan International
  P('Ibrahim Zadran', 'Afghanistan', 'International', 'BAT', 'M', 23, 'R', 'None'),
  P('Hashmatullah Shahidi', 'Afghanistan', 'International', 'BAT', 'S', 30, 'L', 'None'),
  P('Rahmat Shah', 'Afghanistan', 'International', 'BAT', 'S', 31, 'R', 'Right-arm leg-break'),
  P('Gulbadin Naib', 'Afghanistan', 'International', 'AR', 'S', 33, 'R', 'Right-arm medium-fast'),
  P('Najibullah Zadran', 'Afghanistan', 'International', 'BAT', 'S', 32, 'L', 'None'),
  P('Sediqullah Atal', 'Afghanistan', 'International', 'BAT', 'S', 23, 'L', 'None'),
  P('Ikram Alikhil', 'Afghanistan', 'International', 'WK', 'S', 24, 'L', 'None'),
  P('Nangeyalia Kharote', 'Afghanistan', 'International', 'AR', 'D', 20, 'L', 'Left-arm orthodox'),

  // ================= BIG BASH LEAGUE (BBL) =================
  P('Josh Philippe', 'Australia', 'BBL', 'WK', 'M', 27, 'R', 'None'),
  P('Daniel Hughes', 'Australia', 'BBL', 'BAT', 'S', 36, 'L', 'None'),
  P('Jordan Silk', 'Australia', 'BBL', 'BAT', 'S', 32, 'R', 'None'),
  P('Jack Edwards', 'Australia', 'BBL', 'AR', 'S', 24, 'R', 'Right-arm medium-fast'),
  P('Ben Dwarshuis', 'Australia', 'BBL', 'BWL', 'M', 30, 'L', 'Left-arm fast-medium'),
  P('Hayden Kerr', 'Australia', 'BBL', 'AR', 'S', 28, 'R', 'Left-arm fast-medium'),
  P('Ashton Turner', 'Australia', 'BBL', 'BAT', 'M', 32, 'R', 'Right-arm off-break'),
  P('Ashton Agar', 'Australia', 'BBL', 'AR', 'M', 31, 'L', 'Left-arm orthodox'),
  P('Jason Behrendorff', 'Australia', 'BBL', 'BWL', 'M', 34, 'L', 'Left-arm fast-medium'),
  P('Nick Hobson', 'Australia', 'BBL', 'BAT', 'S', 30, 'L', 'None'),
  P('Mahli Beardman', 'Australia', 'BBL', 'BWL', 'D', 19, 'R', 'Right-arm fast'),
  P('Matthew Kelly', 'Australia', 'BBL', 'BWL', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Max Bryant', 'Australia', 'BBL', 'BAT', 'S', 25, 'R', 'None'),
  P('Jimmy Peirson', 'Australia', 'BBL', 'WK', 'S', 32, 'R', 'None'),
  P('Mitchell Swepson', 'Australia', 'BBL', 'BWL', 'S', 31, 'R', 'Right-arm leg-break'),
  P('Callum Vidler', 'Australia', 'BBL', 'BWL', 'D', 19, 'R', 'Right-arm fast'),
  P('Hilton Cartwright', 'Australia', 'BBL', 'BAT', 'S', 33, 'R', 'Right-arm medium'),
  P('Sam Harper', 'Australia', 'BBL', 'WK', 'S', 28, 'R', 'None'),
  P('Tom Rogers', 'Australia', 'BBL', 'BWL', 'S', 30, 'L', 'Right-arm fast-medium'),
  P('Joel Paris', 'Australia', 'BBL', 'BWL', 'S', 32, 'L', 'Left-arm fast-medium'),
  P('Mark Steketee', 'Australia', 'BBL', 'BWL', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Campbell Kellaway', 'Australia', 'BBL', 'BAT', 'D', 22, 'L', 'None'),
  P('Ben McDermott', 'Australia', 'BBL', 'WK', 'M', 30, 'R', 'None'),
  P('Caleb Jewell', 'Australia', 'BBL', 'BAT', 'S', 27, 'L', 'None'),
  P('Mitchell Owen', 'Australia', 'BBL', 'AR', 'M', 23, 'R', 'Right-arm medium'),
  P('Matthew Wade', 'Australia', 'BBL', 'WK', 'M', 37, 'L', 'None'),
  P('Billy Stanlake', 'Australia', 'BBL', 'BWL', 'S', 30, 'L', 'Right-arm fast'),
  P('Nikhil Chaudhary', 'Australia', 'BBL', 'AR', 'S', 28, 'R', 'Right-arm off-break'),
  P("D'Arcy Short", 'Australia', 'BBL', 'AR', 'S', 34, 'L', 'Left-arm wrist-spin'),
  P('Alex Ross', 'Australia', 'BBL', 'BAT', 'S', 32, 'R', 'None'),
  P('Jake Weatherald', 'Australia', 'BBL', 'BAT', 'S', 30, 'L', 'None'),
  P('Henry Thornton', 'Australia', 'BBL', 'BWL', 'S', 28, 'R', 'Right-arm fast'),
  P('Brendan Doggett', 'Australia', 'BBL', 'BWL', 'S', 30, 'R', 'Right-arm fast'),
  P('Lloyd Pope', 'Australia', 'BBL', 'BWL', 'S', 25, 'R', 'Right-arm leg-break'),
  P('Wes Agar', 'Australia', 'BBL', 'BWL', 'S', 28, 'R', 'Right-arm fast'),
  P('Will Sutherland', 'Australia', 'BBL', 'AR', 'M', 25, 'R', 'Right-arm fast-medium'),
  P('Jono Wells', 'Australia', 'BBL', 'BAT', 'S', 36, 'R', 'None'),
  P('Oliver Davies', 'Australia', 'BBL', 'BAT', 'S', 24, 'R', 'None'),
  P('Jason Sangha', 'Australia', 'BBL', 'BAT', 'S', 25, 'R', 'Right-arm leg-break'),
  P('Daniel Sams', 'Australia', 'BBL', 'AR', 'M', 32, 'R', 'Left-arm fast-medium'),
  P('Chris Green', 'Australia', 'BBL', 'AR', 'M', 31, 'R', 'Right-arm off-break'),
  P('Nathan McAndrew', 'Australia', 'BBL', 'BWL', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Tom Andrews', 'Australia', 'BBL', 'AR', 'D', 30, 'L', 'Left-arm orthodox'),
  P('Gurinder Sandhu', 'Australia', 'BBL', 'BWL', 'S', 31, 'L', 'Right-arm fast-medium'),
  P('Harry Dixon', 'Australia', 'BBL', 'BAT', 'D', 20, 'L', 'None'),
  P('Kurtis Patterson', 'Australia', 'BBL', 'BAT', 'S', 31, 'L', 'None'),
  P('Matthew Gilkes', 'Australia', 'BBL', 'WK', 'S', 25, 'L', 'None'),
  P('Liam Hatcher', 'Australia', 'BBL', 'BWL', 'S', 28, 'R', 'Right-arm fast'),
  P('Jackson Bird', 'Australia', 'BBL', 'BWL', 'S', 38, 'R', 'Right-arm fast-medium'),
  P("Fergus O'Neill", 'Australia', 'BBL', 'BWL', 'S', 23, 'R', 'Right-arm medium-fast'),
  P('Jack Wildermuth', 'Australia', 'BBL', 'AR', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Ben Manenti', 'Australia', 'BBL', 'BWL', 'S', 27, 'R', 'Right-arm off-break'),
  P('Sam Whiteman', 'Australia', 'BBL', 'WK', 'S', 32, 'L', 'None'),
  P('Jake Lehmann', 'Australia', 'BBL', 'BAT', 'S', 32, 'L', 'None'),
  P('Mackenzie Harvey', 'Australia', 'BBL', 'BAT', 'S', 24, 'L', 'None'),
  P('Thomas Kelly', 'Australia', 'BBL', 'BAT', 'D', 24, 'R', 'None'),
  P('Peter Siddle', 'Australia', 'BBL', 'BWL', 'M', 40, 'R', 'Right-arm fast-medium'),
  P('Nathan Coulter-Nile', 'Australia', 'BBL', 'BWL', 'S', 37, 'R', 'Right-arm fast'),

  // ================= THE HUNDRED =================
  P('Dawid Malan', 'England', 'The Hundred', 'BAT', 'M', 37, 'L', 'Right-arm leg-break'),
  P('Alex Hales', 'England', 'The Hundred', 'BAT', 'M', 36, 'R', 'None'),
  P('Luke Wood', 'England', 'The Hundred', 'BWL', 'M', 29, 'L', 'Left-arm fast-medium'),
  P('John Turner', 'England', 'The Hundred', 'BWL', 'S', 23, 'R', 'Right-arm fast'),
  P('Sam Hain', 'England', 'The Hundred', 'BAT', 'M', 29, 'R', 'None'),
  P('James Vince', 'England', 'The Hundred', 'BAT', 'M', 33, 'R', 'None'),
  P('Alex Davies', 'England', 'The Hundred', 'WK', 'S', 30, 'R', 'None'),
  P('Craig Overton', 'England', 'The Hundred', 'BWL', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Dan Mousley', 'England', 'The Hundred', 'AR', 'S', 23, 'L', 'Right-arm off-break'),
  P('Benny Howell', 'England', 'The Hundred', 'AR', 'S', 36, 'R', 'Right-arm medium'),
  P('Laurie Evans', 'England', 'The Hundred', 'BAT', 'S', 37, 'R', 'None'),
  P('Wayne Parnell', 'South Africa', 'The Hundred', 'AR', 'S', 35, 'L', 'Left-arm fast-medium'),
  P('Luke Wells', 'England', 'The Hundred', 'BAT', 'S', 34, 'L', 'Right-arm leg-break'),
  P('Max Holden', 'England', 'The Hundred', 'BAT', 'S', 27, 'L', 'None'),
  P('Sonny Baker', 'England', 'The Hundred', 'BWL', 'D', 21, 'R', 'Right-arm fast'),
  P('Daniel Worrall', 'England', 'The Hundred', 'BWL', 'S', 33, 'R', 'Right-arm fast-medium'),
  P('Michael Pepper', 'England', 'The Hundred', 'WK', 'S', 26, 'R', 'None'),
  P('Richard Gleeson', 'England', 'The Hundred', 'BWL', 'S', 37, 'R', 'Right-arm fast'),
  P('Luke Fletcher', 'England', 'The Hundred', 'BWL', 'S', 36, 'R', 'Right-arm medium-fast'),
  P('Pat Brown', 'England', 'The Hundred', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Henry Brookes', 'England', 'The Hundred', 'BWL', 'D', 25, 'R', 'Right-arm fast'),
  P('Nathan Sowter', 'England', 'The Hundred', 'BWL', 'S', 32, 'R', 'Right-arm leg-break'),
  P('Tawanda Muyeye', 'England', 'The Hundred', 'BAT', 'D', 23, 'R', 'None'),
  P('Tom Kohler-Cadmore', 'England', 'The Hundred', 'BAT', 'M', 30, 'R', 'None'),
  P('Jordan Cox', 'England', 'The Hundred', 'WK', 'M', 24, 'R', 'None'),
  P('Dan Lawrence', 'England', 'The Hundred', 'AR', 'M', 27, 'R', 'Right-arm off-break'),
  P('Liam Dawson', 'England', 'The Hundred', 'AR', 'M', 34, 'R', 'Left-arm orthodox'),
  P('Tom Abell', 'England', 'The Hundred', 'BAT', 'S', 30, 'R', 'None'),
  P('Lewis Gregory', 'England', 'The Hundred', 'AR', 'M', 32, 'R', 'Right-arm fast-medium'),
  P('Sam Cook', 'England', 'The Hundred', 'BWL', 'M', 27, 'R', 'Right-arm fast-medium'),
  P('Matt Critchley', 'England', 'The Hundred', 'AR', 'S', 28, 'R', 'Right-arm leg-break'),
  P('Adam Rossington', 'England', 'The Hundred', 'WK', 'S', 31, 'R', 'None'),
  P('Joe Clarke', 'England', 'The Hundred', 'WK', 'S', 28, 'R', 'None'),
  P('Adam Lyth', 'England', 'The Hundred', 'BAT', 'S', 37, 'L', 'Right-arm off-break'),
  P('David Payne', 'England', 'The Hundred', 'BWL', 'S', 34, 'L', 'Left-arm fast-medium'),
  P('Mason Crane', 'England', 'The Hundred', 'BWL', 'S', 28, 'R', 'Right-arm leg-break'),
  P('Olly Stone', 'England', 'The Hundred', 'BWL', 'M', 31, 'R', 'Right-arm fast'),
  P('Dillon Pennington', 'England', 'The Hundred', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Adam Hose', 'England', 'The Hundred', 'BAT', 'S', 32, 'R', 'None'),
  P('Ben Mike', 'England', 'The Hundred', 'AR', 'S', 26, 'R', 'Right-arm medium-fast'),
  P('George Garton', 'England', 'The Hundred', 'BWL', 'S', 27, 'L', 'Left-arm fast'),
  P('Keaton Jennings', 'England', 'The Hundred', 'BAT', 'S', 32, 'L', 'None'),
  P('Rory Burns', 'England', 'The Hundred', 'BAT', 'S', 34, 'L', 'None'),
  P('Dom Sibley', 'England', 'The Hundred', 'BAT', 'S', 29, 'R', 'None'),

  // ================= PAKISTAN SUPER LEAGUE (PSL) =================
  P('Sahibzada Farhan', 'Pakistan', 'PSL', 'BAT', 'M', 29, 'R', 'None'),
  P('Mohammad Haris', 'Pakistan', 'PSL', 'WK', 'M', 23, 'R', 'None'),
  P('Azam Khan', 'Pakistan', 'PSL', 'WK', 'M', 26, 'R', 'None'),
  P('Usman Khan', 'Pakistan', 'PSL', 'WK', 'M', 29, 'R', 'None'),
  P('Asif Ali', 'Pakistan', 'PSL', 'BAT', 'S', 33, 'R', 'None'),
  P('Khushdil Shah', 'Pakistan', 'PSL', 'AR', 'M', 30, 'L', 'Left-arm orthodox'),
  P('Faheem Ashraf', 'Pakistan', 'PSL', 'AR', 'M', 31, 'L', 'Right-arm medium-fast'),
  P('Mohammad Hasnain', 'Pakistan', 'PSL', 'BWL', 'M', 24, 'R', 'Right-arm fast'),
  P('Zaman Khan', 'Pakistan', 'PSL', 'BWL', 'M', 23, 'R', 'Right-arm fast'),
  P('Abbas Afridi', 'Pakistan', 'PSL', 'BWL', 'M', 23, 'R', 'Right-arm fast-medium'),
  P('Ihsanullah', 'Pakistan', 'PSL', 'BWL', 'M', 22, 'R', 'Right-arm fast'),
  P('Hassan Nawaz', 'Pakistan', 'PSL', 'BAT', 'S', 22, 'R', 'None'),
  P('Kamran Ghulam', 'Pakistan', 'PSL', 'BAT', 'S', 29, 'R', 'Left-arm orthodox'),
  P('Haider Ali', 'Pakistan', 'PSL', 'BAT', 'S', 24, 'R', 'None'),
  P('Jahandad Khan', 'Pakistan', 'PSL', 'AR', 'S', 21, 'L', 'Left-arm fast-medium'),
  P('Sufiyan Muqeem', 'Pakistan', 'PSL', 'BWL', 'S', 25, 'L', 'Left-arm wrist-spin'),
  P('Mir Hamza', 'Pakistan', 'PSL', 'BWL', 'S', 32, 'L', 'Left-arm fast-medium'),
  P('Wahab Riaz', 'Pakistan', 'PSL', 'BWL', 'M', 38, 'R', 'Left-arm fast'),
  P('Saeed Ajmal', 'Pakistan', 'PSL', 'BWL', 'L', 38, 'R', 'Right-arm off-break'),
  P('Yasir Shah', 'Pakistan', 'PSL', 'BWL', 'M', 37, 'R', 'Right-arm leg-break'),
  P('Haseebullah Khan', 'Pakistan', 'PSL', 'WK', 'D', 21, 'L', 'None'),
  P('Arafat Minhas', 'Pakistan', 'PSL', 'AR', 'D', 20, 'L', 'Left-arm orthodox'),
  P('Hunain Shah', 'Pakistan', 'PSL', 'BWL', 'D', 21, 'R', 'Right-arm fast'),
  P('Ubaid Shah', 'Pakistan', 'PSL', 'BWL', 'D', 19, 'R', 'Right-arm fast'),
  P('Tayyab Tahir', 'Pakistan', 'PSL', 'BAT', 'S', 31, 'R', 'None'),
  P('Omair Yousuf', 'Pakistan', 'PSL', 'BAT', 'S', 26, 'R', 'None'),
  P('Mehran Mumtaz', 'Pakistan', 'PSL', 'BWL', 'D', 21, 'L', 'Left-arm orthodox'),
  P('Akif Javed', 'Pakistan', 'PSL', 'BWL', 'S', 24, 'L', 'Left-arm fast-medium'),

  // ================= SA20 =================
  P('Lhuan-dre Pretorius', 'South Africa', 'SA20', 'WK', 'M', 18, 'L', 'None'),
  P('Rubin Hermann', 'South Africa', 'SA20', 'WK', 'S', 28, 'L', 'None'),
  P('Jordan Hermann', 'South Africa', 'SA20', 'BAT', 'S', 23, 'L', 'None'),
  P('Lutho Sipamla', 'South Africa', 'SA20', 'BWL', 'S', 26, 'R', 'Right-arm fast'),
  P('Eathan Bosch', 'South Africa', 'SA20', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Nqaba Peter', 'South Africa', 'SA20', 'BWL', 'S', 22, 'R', 'Right-arm leg-break'),
  P('Beyers Swanepoel', 'South Africa', 'SA20', 'AR', 'S', 26, 'L', 'Right-arm fast-medium'),
  P('Delano Potgieter', 'South Africa', 'SA20', 'AR', 'S', 28, 'L', 'Right-arm medium-fast'),
  P('Dayyaan Galiem', 'South Africa', 'SA20', 'AR', 'S', 28, 'R', 'Right-arm medium-fast'),
  P('Duan Jansen', 'South Africa', 'SA20', 'AR', 'S', 24, 'R', 'Left-arm fast-medium'),
  P('Sisanda Magala', 'South Africa', 'SA20', 'BWL', 'M', 34, 'R', 'Right-arm fast-medium'),
  P('Beuran Hendricks', 'South Africa', 'SA20', 'BWL', 'S', 34, 'L', 'Left-arm fast-medium'),
  P('Junior Dala', 'South Africa', 'SA20', 'BWL', 'S', 35, 'R', 'Right-arm fast-medium'),
  P('Simon Harmer', 'South Africa', 'SA20', 'BWL', 'M', 35, 'R', 'Right-arm off-break'),
  P('Prenelan Subrayen', 'South Africa', 'SA20', 'BWL', 'S', 31, 'R', 'Right-arm off-break'),
  P('Wihan Lubbe', 'South Africa', 'SA20', 'AR', 'S', 32, 'L', 'Right-arm off-break'),
  P('Jason Smith', 'South Africa', 'SA20', 'AR', 'S', 30, 'R', 'Right-arm medium-fast'),
  P('Sarel Erwee', 'South Africa', 'SA20', 'BAT', 'S', 35, 'L', 'None'),
  P('Tristan Luus', 'South Africa', 'SA20', 'BWL', 'D', 19, 'R', 'Right-arm fast'),
  P('Connor Esterhuizen', 'South Africa', 'SA20', 'WK', 'D', 23, 'R', 'None'),
  P('Codi Yusuf', 'South Africa', 'SA20', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('George Linde', 'South Africa', 'SA20', 'AR', 'M', 33, 'L', 'Left-arm orthodox'),
  P('Migael Pretorius', 'South Africa', 'SA20', 'AR', 'S', 29, 'R', 'Right-arm fast-medium'),

  // ================= ADDITIONAL AUTHENTIC PSL DOMESTIC POOL =================
  P('Mohammad Huraira', 'Pakistan', 'PSL', 'BAT', 'S', 22, 'R', 'None'),
  P('Haseeb-ul-Haq', 'Pakistan', 'PSL', 'BAT', 'D', 24, 'R', 'None'),
  P('Saud Akram', 'Pakistan', 'PSL', 'BWL', 'D', 23, 'R', 'Right-arm fast-medium'),
  P('Mirza Tahir Baig', 'Pakistan', 'PSL', 'BAT', 'S', 25, 'R', 'None'),
  P('Muhammad Akhlaq', 'Pakistan', 'PSL', 'WK', 'S', 32, 'R', 'None'),
  P('Rohail Nazir', 'Pakistan', 'PSL', 'WK', 'S', 23, 'R', 'None'),
  P('Mohammad Haris Khan', 'Pakistan', 'PSL', 'BAT', 'D', 24, 'L', 'None'),
  P('Ahsan Bhatti', 'Pakistan', 'PSL', 'AR', 'D', 27, 'L', 'Left-arm orthodox'),
  P('Mubasir Khan', 'Pakistan', 'PSL', 'AR', 'S', 22, 'R', 'Right-arm off-break'),
  P('Qasim Akram', 'Pakistan', 'PSL', 'AR', 'S', 22, 'R', 'Right-arm off-break'),
  P('Zeeshan Zameer', 'Pakistan', 'PSL', 'BWL', 'D', 22, 'R', 'Right-arm fast'),
  P('Shahnawaz Dahani', 'Pakistan', 'PSL', 'BWL', 'S', 26, 'R', 'Right-arm fast'),
  P('Mohammad Hasnain Ali', 'Pakistan', 'PSL', 'BWL', 'D', 24, 'R', 'Right-arm medium-fast'),
  P('Salman Irshad', 'Pakistan', 'PSL', 'BWL', 'S', 29, 'R', 'Right-arm fast'),
  P('Rumman Raees', 'Pakistan', 'PSL', 'BWL', 'S', 33, 'L', 'Left-arm fast-medium'),
  P('Umer Khan', 'Pakistan', 'PSL', 'BWL', 'D', 25, 'L', 'Left-arm orthodox'),
  P('Arshad Iqbal', 'Pakistan', 'PSL', 'BWL', 'S', 24, 'R', 'Right-arm fast-medium'),
  P('Mohammad Musa', 'Pakistan', 'PSL', 'BWL', 'S', 24, 'R', 'Right-arm fast'),
  P('Irfan Khan Niazi', 'Pakistan', 'PSL', 'BAT', 'S', 22, 'R', 'Right-arm medium'),
  P('Sahibzada Usman', 'Pakistan', 'PSL', 'BAT', 'D', 23, 'R', 'None'),
  P('Amad Butt', 'Pakistan', 'PSL', 'AR', 'S', 29, 'R', 'Right-arm fast-medium'),
  P('Hussain Talat', 'Pakistan', 'PSL', 'AR', 'S', 29, 'L', 'Right-arm medium'),
  P('Danish Aziz', 'Pakistan', 'PSL', 'AR', 'S', 29, 'L', 'Left-arm orthodox'),
  P('Aamer Yamin', 'Pakistan', 'PSL', 'AR', 'S', 34, 'R', 'Right-arm medium-fast'),
  P('Sohail Khan', 'Pakistan', 'PSL', 'BWL', 'S', 40, 'R', 'Right-arm fast-medium'),
  P('Bilawal Bhatti', 'Pakistan', 'PSL', 'AR', 'S', 33, 'R', 'Right-arm medium-fast'),
  P('Usman Qadir', 'Pakistan', 'PSL', 'BWL', 'S', 31, 'L', 'Right-arm leg-break'),
  P('Zahid Mahmood', 'Pakistan', 'PSL', 'BWL', 'S', 36, 'R', 'Right-arm leg-break'),
  P('Faisal Akram', 'Pakistan', 'PSL', 'BWL', 'D', 21, 'L', 'Left-arm wrist-spin'),
  P('Mohammad Ali', 'Pakistan', 'PSL', 'BWL', 'S', 32, 'R', 'Right-arm fast-medium'),
  P('Sameen Gul', 'Pakistan', 'PSL', 'BWL', 'D', 25, 'R', 'Right-arm medium-fast'),
  P('Sharjeel Khan', 'Pakistan', 'PSL', 'BAT', 'M', 35, 'L', 'None'),
  P('Ahmed Shehzad', 'Pakistan', 'PSL', 'BAT', 'M', 33, 'R', 'Right-arm leg-break'),
  P('Umar Akmal', 'Pakistan', 'PSL', 'WK', 'S', 34, 'R', 'None'),
  P('Kamran Akmal', 'Pakistan', 'PSL', 'WK', 'M', 42, 'R', 'None'),
  P('Mohammad Hafeez', 'Pakistan', 'PSL', 'AR', 'L', 43, 'R', 'Right-arm off-break'),
  P('Shoaib Malik', 'Pakistan', 'PSL', 'AR', 'L', 42, 'R', 'Right-arm off-break'),
  P('Sohaib Maqsood', 'Pakistan', 'PSL', 'BAT', 'S', 37, 'R', 'Right-arm off-break'),
  P('Haris Sohail', 'Pakistan', 'PSL', 'BAT', 'S', 36, 'L', 'Left-arm orthodox'),
  P('Shanawaz Khan', 'Pakistan', 'PSL', 'BAT', 'D', 23, 'R', 'None'),
  P('Bismillah Khan', 'Pakistan', 'PSL', 'WK', 'D', 34, 'R', 'None'),
  P('Zeeshan Ashraf', 'Pakistan', 'PSL', 'WK', 'S', 32, 'L', 'None'),
  P('Khawaja Nafay', 'Pakistan', 'PSL', 'BAT', 'S', 22, 'R', 'None'),
  P('Abdul Bangalzai', 'Pakistan', 'PSL', 'BAT', 'D', 21, 'R', 'None'),
  P('Yasir Khan', 'Pakistan', 'PSL', 'BAT', 'S', 22, 'R', 'None'),
  P('Mohammad Zeeshan', 'Pakistan', 'PSL', 'BWL', 'D', 19, 'R', 'Right-arm fast'),
  P('Nisar Ahmad', 'Pakistan', 'PSL', 'BWL', 'D', 29, 'R', 'Right-arm fast-medium'),
  P('Tashfeen Qureshi', 'Pakistan', 'PSL', 'BWL', 'D', 24, 'R', 'Right-arm fast-medium'),
  P('Saad Baig', 'Pakistan', 'PSL', 'WK', 'D', 19, 'L', 'None'),
  P('Arafat Bhutto', 'Pakistan', 'PSL', 'AR', 'D', 22, 'R', 'Right-arm off-break'),
  P('Ali Raza', 'Pakistan', 'PSL', 'BWL', 'D', 18, 'R', 'Right-arm fast'),
  P('Usman Tariq', 'Pakistan', 'PSL', 'BWL', 'S', 27, 'R', 'Right-arm off-break'),

  // ================= ADDITIONAL AUTHENTIC SA20 DOMESTIC POOL =================
  P('Rivaldo Moonsamy', 'South Africa', 'SA20', 'WK', 'S', 28, 'R', 'None'),
  P('Gihahn Cloete', 'South Africa', 'SA20', 'WK', 'S', 32, 'L', 'None'),
  P('Grant Roelofsen', 'South Africa', 'SA20', 'WK', 'S', 28, 'R', 'None'),
  P('Clyde Fortuin', 'South Africa', 'SA20', 'WK', 'S', 29, 'R', 'None'),
  P('Wandile Makwetu', 'South Africa', 'SA20', 'WK', 'D', 26, 'R', 'None'),
  P('Sine Qeshile', 'South Africa', 'SA20', 'WK', 'S', 25, 'R', 'None'),
  P('Andries Gous', 'South Africa', 'SA20', 'WK', 'S', 31, 'R', 'None'),
  P('Meeka-eel Prince', 'South Africa', 'SA20', 'WK', 'D', 24, 'R', 'None'),
  P('Janneman Malan', 'South Africa', 'SA20', 'BAT', 'S', 28, 'R', 'None'),
  P('Pieter Malan', 'South Africa', 'SA20', 'BAT', 'S', 35, 'R', 'None'),
  P('Keegan Petersen', 'South Africa', 'SA20', 'BAT', 'S', 31, 'R', 'None'),
  P('Theunis de Bruyn', 'South Africa', 'SA20', 'BAT', 'S', 32, 'R', 'None'),
  P('Mitchell van Buuren', 'South Africa', 'SA20', 'BAT', 'S', 27, 'R', 'None'),
  P('Raynard van Tonder', 'South Africa', 'SA20', 'BAT', 'S', 26, 'R', 'None'),
  P('Marques Ackerman', 'South Africa', 'SA20', 'BAT', 'S', 28, 'L', 'None'),
  P('Lesiba Ngoepe', 'South Africa', 'SA20', 'BAT', 'D', 31, 'L', 'None'),
  P('Jacques Snyman', 'South Africa', 'SA20', 'AR', 'S', 30, 'R', 'Right-arm off-break'),
  P('Bryce Parsons', 'South Africa', 'SA20', 'AR', 'S', 24, 'L', 'Left-arm orthodox'),
  P('Evan Jones', 'South Africa', 'SA20', 'AR', 'S', 28, 'R', 'Right-arm medium-fast'),
  P('Patrick Kruger', 'South Africa', 'SA20', 'AR', 'S', 30, 'R', 'Right-arm medium-fast'),
  P('Jon-Jon Smuts', 'South Africa', 'SA20', 'AR', 'S', 36, 'R', 'Left-arm orthodox'),
  P('Dwaine Pretorius', 'South Africa', 'SA20', 'AR', 'M', 35, 'R', 'Right-arm fast-medium'),
  P('Wayne Madsen', 'South Africa', 'SA20', 'BAT', 'S', 41, 'R', 'Right-arm off-break'),
  P('Roelof van der Merwe', 'South Africa', 'SA20', 'AR', 'S', 40, 'R', 'Left-arm orthodox'),
  P('Andile Simelane', 'South Africa', 'SA20', 'AR', 'D', 21, 'R', 'Right-arm fast-medium'),
  P('Mihlali Mpongwana', 'South Africa', 'SA20', 'AR', 'D', 24, 'R', 'Right-arm medium-fast'),
  P('Liam Alder', 'South Africa', 'SA20', 'BWL', 'D', 21, 'R', 'Left-arm orthodox'),
  P('Caleb Seleka', 'South Africa', 'SA20', 'BWL', 'D', 22, 'R', 'Right-arm leg-break'),
  P('Imran Manack', 'South Africa', 'SA20', 'BWL', 'D', 33, 'R', 'Right-arm off-break'),
  P('Aaron Phangiso', 'South Africa', 'SA20', 'BWL', 'S', 41, 'R', 'Left-arm orthodox'),
  P('Kyle Simmonds', 'South Africa', 'SA20', 'BWL', 'D', 31, 'L', 'Left-arm orthodox'),
  P('Gideon Peters', 'South Africa', 'SA20', 'BWL', 'D', 25, 'R', 'Right-arm fast-medium'),
  P('Okuhle Cele', 'South Africa', 'SA20', 'BWL', 'D', 27, 'R', 'Right-arm fast'),
  P('Daryn Dupavillon', 'South Africa', 'SA20', 'BWL', 'S', 30, 'R', 'Right-arm fast'),
  P('Tshepo Moreki', 'South Africa', 'SA20', 'BWL', 'S', 31, 'R', 'Right-arm fast-medium'),
  P('Hardus Viljoen', 'South Africa', 'SA20', 'BWL', 'S', 35, 'R', 'Right-arm fast'),
  P('Lizaad Williams', 'South Africa', 'SA20', 'BWL', 'M', 31, 'L', 'Right-arm fast-medium'),
  P('Glenton Stuurman', 'South Africa', 'SA20', 'BWL', 'S', 32, 'R', 'Right-arm fast-medium'),
  P('Siya Plaatjie', 'South Africa', 'SA20', 'BWL', 'D', 25, 'R', 'Right-arm fast-medium'),
  P('Thando Ntini', 'South Africa', 'SA20', 'BWL', 'D', 24, 'L', 'Right-arm medium-fast'),
  P('Thomas Kaber', 'South Africa', 'SA20', 'BWL', 'D', 32, 'R', 'Left-arm wrist-spin'),
  P('Keith Dudgeon', 'South Africa', 'SA20', 'BWL', 'D', 29, 'R', 'Right-arm medium-fast'),
  P('Ruan de Swardt', 'South Africa', 'SA20', 'AR', 'S', 27, 'L', 'Right-arm medium'),
  P('Dewan Marais', 'South Africa', 'SA20', 'BAT', 'D', 20, 'R', 'None'),
  P('Steve Stolk', 'South Africa', 'SA20', 'BAT', 'D', 19, 'R', 'None'),

  // ================= ADDITIONAL AUTHENTIC BBL DOMESTIC POOL =================
  P('Nic Maddinson', 'Australia', 'BBL', 'BAT', 'S', 33, 'L', 'Left-arm orthodox'),
  P('Will Pucovski', 'Australia', 'BBL', 'BAT', 'S', 27, 'R', 'None'),
  P('Sam Fanning', 'Australia', 'BBL', 'BAT', 'D', 24, 'L', 'None'),
  P('Lachlan Hearne', 'Australia', 'BBL', 'BAT', 'D', 24, 'L', 'None'),
  P('Jake Carder', 'Australia', 'BBL', 'BAT', 'D', 29, 'L', 'None'),
  P('Hugh Weibgen', 'Australia', 'BBL', 'BAT', 'D', 20, 'R', 'Right-arm off-break'),
  P('Harry Conway', 'Australia', 'BBL', 'BWL', 'D', 32, 'R', 'Right-arm fast-medium'),
  P('Jordan Buckingham', 'Australia', 'BBL', 'BWL', 'S', 24, 'R', 'Right-arm fast-medium'),
  P('Cameron Boyce', 'Australia', 'BBL', 'BWL', 'S', 35, 'R', 'Right-arm leg-break'),
  P('Fawad Ahmed', 'Australia', 'BBL', 'BWL', 'S', 43, 'R', 'Right-arm leg-break'),
  P('Paddy Dooley', 'Australia', 'BBL', 'BWL', 'S', 27, 'R', 'Left-arm orthodox'),
  P('Corey Rocchiccioli', 'Australia', 'BBL', 'BWL', 'S', 27, 'R', 'Right-arm off-break'),
  P('Joel Davies', 'Australia', 'BBL', 'AR', 'D', 21, 'L', 'Left-arm orthodox'),
  P('Ollie Peake', 'Australia', 'BBL', 'BAT', 'D', 18, 'L', 'None'),
  P('Baxter Holt', 'Australia', 'BBL', 'WK', 'D', 25, 'R', 'None'),
  P('Lachlan Pfeffer', 'Australia', 'BBL', 'WK', 'D', 33, 'R', 'None'),
  P('Jay Lenton', 'Australia', 'BBL', 'WK', 'D', 34, 'R', 'None'),
  P('Jake Doran', 'Australia', 'BBL', 'WK', 'S', 28, 'L', 'None'),
  P('Liam Scott', 'Australia', 'BBL', 'AR', 'D', 24, 'R', 'Right-arm medium-fast'),
  P('Toby Gray', 'Australia', 'BBL', 'BWL', 'D', 25, 'R', 'Right-arm leg-break'),
  P('Cameron Gannon', 'Australia', 'BBL', 'BWL', 'S', 36, 'R', 'Right-arm fast-medium'),
  P('Charlie Stobo', 'Australia', 'BBL', 'BWL', 'D', 29, 'R', 'Right-arm fast-medium'),
  P('Mitchell Perry', 'Australia', 'BBL', 'BWL', 'S', 24, 'R', 'Right-arm fast-medium'),
  P('Brody Couch', 'Australia', 'BBL', 'BWL', 'D', 25, 'R', 'Right-arm fast-medium'),
  P('Blake Nikitaras', 'Australia', 'BBL', 'BAT', 'D', 24, 'L', 'None'),
  P('Jack Clayton', 'Australia', 'BBL', 'BAT', 'D', 25, 'L', 'None'),
  P('Macalister Wright', 'Australia', 'BBL', 'BAT', 'S', 27, 'R', 'Right-arm leg-break'),
  P('Charlie Wakim', 'Australia', 'BBL', 'BAT', 'S', 33, 'R', 'None'),

  // ================= ADDITIONAL AUTHENTIC THE HUNDRED DOMESTIC POOL =================
  P('Haseeb Hameed', 'England', 'The Hundred', 'BAT', 'S', 28, 'R', 'None'),
  P('Ben Slater', 'England', 'The Hundred', 'BAT', 'S', 33, 'L', 'None'),
  P('Matthew Fisher', 'England', 'The Hundred', 'BWL', 'S', 27, 'R', 'Right-arm fast'),
  P('Sam Northeast', 'England', 'The Hundred', 'BAT', 'S', 35, 'R', 'None'),
  P('Kiran Carlson', 'England', 'The Hundred', 'BAT', 'S', 26, 'R', 'Right-arm off-break'),
  P('Chris Cooke', 'England', 'The Hundred', 'WK', 'S', 38, 'R', 'None'),
  P('Timm van der Gugten', 'England', 'The Hundred', 'BWL', 'S', 34, 'R', 'Right-arm fast-medium'),
  P('Ben Foakes', 'England', 'The Hundred', 'WK', 'M', 32, 'R', 'None'),
  P('Ollie Price', 'England', 'The Hundred', 'AR', 'S', 23, 'R', 'Right-arm off-break'),
  P('James Bracey', 'England', 'The Hundred', 'WK', 'S', 27, 'L', 'None'),
  P('Miles Hammond', 'England', 'The Hundred', 'BAT', 'S', 29, 'L', 'Right-arm off-break'),
  P('Graeme van Buuren', 'England', 'The Hundred', 'AR', 'S', 34, 'R', 'Left-arm orthodox'),
  P('Matt Taylor', 'England', 'The Hundred', 'BWL', 'S', 30, 'L', 'Left-arm fast-medium'),
  P('Josh Shaw', 'England', 'The Hundred', 'BWL', 'D', 29, 'R', 'Right-arm fast-medium'),
  P('George Scrimshaw', 'England', 'The Hundred', 'BWL', 'S', 27, 'R', 'Right-arm fast'),
  P('Zak Chappell', 'England', 'The Hundred', 'BWL', 'S', 28, 'R', 'Right-arm fast-medium'),
  P('Alex Thomson', 'England', 'The Hundred', 'BWL', 'D', 31, 'R', 'Right-arm off-break'),
  P('Harry Came', 'England', 'The Hundred', 'BAT', 'D', 26, 'R', 'Right-arm off-break'),
  P('Brooke Guest', 'England', 'The Hundred', 'WK', 'S', 27, 'R', 'None'),
  P('Tom Taylor', 'England', 'The Hundred', 'AR', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Luis Reece', 'England', 'The Hundred', 'AR', 'S', 34, 'L', 'Left-arm medium'),
  P('Ben Aitchison', 'England', 'The Hundred', 'BWL', 'D', 25, 'R', 'Right-arm fast-medium'),
  P('Sam Conners', 'England', 'The Hundred', 'BWL', 'S', 26, 'R', 'Right-arm fast-medium'),
  P('Saif Zaib', 'England', 'The Hundred', 'AR', 'S', 26, 'L', 'Left-arm orthodox'),
  P('Ricardo Vasconcelos', 'England', 'The Hundred', 'WK', 'S', 27, 'L', 'None'),
  P('Emilio Gay', 'England', 'The Hundred', 'BAT', 'S', 24, 'L', 'None'),
  P('Luke Procter', 'England', 'The Hundred', 'AR', 'S', 36, 'L', 'Right-arm medium'),
  P('Ben Sanderson', 'England', 'The Hundred', 'BWL', 'S', 36, 'R', 'Right-arm fast-medium'),
  P('Freddie Heldreich', 'England', 'The Hundred', 'BWL', 'D', 23, 'R', 'Left-arm wrist-spin'),
  P('Tom Prest', 'England', 'The Hundred', 'BAT', 'S', 21, 'R', 'Right-arm off-break'),
  P('Toby Albert', 'England', 'The Hundred', 'WK', 'D', 23, 'R', 'None'),
  P('Nick Gubbins', 'England', 'The Hundred', 'BAT', 'S', 31, 'L', 'Right-arm leg-break'),
  P('Fletcha Middleton', 'England', 'The Hundred', 'BAT', 'D', 23, 'R', 'None'),
  P('Brad Wheal', 'England', 'The Hundred', 'BWL', 'S', 28, 'R', 'Right-arm fast'),
  P('Scott Currie', 'England', 'The Hundred', 'BWL', 'S', 23, 'R', 'Right-arm fast-medium'),
  P('Felix Organ', 'England', 'The Hundred', 'AR', 'D', 25, 'R', 'Right-arm off-break'),
  P('Dan Douthwaite', 'England', 'The Hundred', 'AR', 'S', 28, 'R', 'Right-arm fast-medium'),
  P('Ed Barnard', 'England', 'The Hundred', 'AR', 'S', 29, 'R', 'Right-arm medium-fast'),
  P('Rob Yates', 'England', 'The Hundred', 'BAT', 'S', 25, 'L', 'Right-arm off-break'),
  P('Will Rhodes', 'England', 'The Hundred', 'AR', 'S', 29, 'L', 'Right-arm medium'),
  P('Danny Briggs', 'England', 'The Hundred', 'BWL', 'S', 33, 'R', 'Left-arm orthodox'),
  P('Jake Lintott', 'England', 'The Hundred', 'BWL', 'S', 31, 'R', 'Left-arm wrist-spin'),
  P('Craig Miles', 'England', 'The Hundred', 'BWL', 'S', 30, 'R', 'Right-arm fast-medium'),
  P('Tom Lawes', 'England', 'The Hundred', 'BWL', 'S', 22, 'R', 'Right-arm fast-medium'),
  P('Ryan Patel', 'England', 'The Hundred', 'BAT', 'S', 27, 'L', 'Right-arm medium'),
  P('Ollie Sykes', 'England', 'The Hundred', 'BAT', 'D', 20, 'L', 'None'),
  P('Cameron Steel', 'England', 'The Hundred', 'AR', 'S', 29, 'R', 'Right-arm leg-break'),
  P('Callum Parkinson', 'England', 'The Hundred', 'BWL', 'S', 28, 'R', 'Left-arm orthodox'),
  P('Ben Raine', 'England', 'The Hundred', 'AR', 'S', 33, 'L', 'Right-arm medium-fast'),
  P('Jack Blatherwick', 'England', 'The Hundred', 'BWL', 'D', 26, 'R', 'Right-arm fast-medium'),
  P('George Hill', 'England', 'The Hundred', 'AR', 'S', 24, 'R', 'Right-arm medium-fast'),
  P('Matthew Revis', 'England', 'The Hundred', 'AR', 'D', 23, 'R', 'Right-arm fast-medium'),
  P('Finlay Bean', 'England', 'The Hundred', 'BAT', 'D', 22, 'L', 'None'),
  P('Jonny Tattersall', 'England', 'The Hundred', 'WK', 'S', 30, 'R', 'None'),
  P('Dom Bess', 'England', 'The Hundred', 'BWL', 'S', 27, 'R', 'Right-arm off-break'),
  P('Jack Shantry', 'England', 'The Hundred', 'BWL', 'D', 36, 'L', 'Left-arm medium-fast'),
  P('Gareth Roderick', 'England', 'The Hundred', 'WK', 'S', 33, 'R', 'None'),
  P('Brett D\'Oliveira', 'England', 'The Hundred', 'AR', 'S', 32, 'R', 'Right-arm leg-break'),
];

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export const MARQUEE_SET_ORDER = [
  'Marquee Stars',
  'Opening Batters',
  'Middle-Order Batters',
  'Wicketkeepers',
  'All-Rounders',
  'Fast Bowlers',
  'Spinners',
] as const;

export type MarqueeSetName = (typeof MARQUEE_SET_ORDER)[number];

const KNOWN_MARQUEE_STARS = new Set([
  'Virat Kohli',
  'MS Dhoni',
  'Rohit Sharma',
  'Jasprit Bumrah',
  'Suryakumar Yadav',
  'Shubman Gill',
  'Yashasvi Jaiswal',
  'Rishabh Pant',
  'Hardik Pandya',
  'Ravindra Jadeja',
  'Rashid Khan',
  'Sunil Narine',
  'Andre Russell',
  'Jos Buttler',
  'Pat Cummins',
  'Mitchell Starc',
  'Trent Boult',
  'Kagiso Rabada',
  'Heinrich Klaasen',
  'Nicholas Pooran',
  'Travis Head',
  'David Warner',
  'Glenn Maxwell',
  'Babar Azam',
  'Mohammad Rizwan',
  'Shaheen Shah Afridi',
  'Naseem Shah',
  'Haris Rauf',
  'Fakhar Zaman',
  'Shadab Khan',
  'Joe Root',
  'Ben Stokes',
  'Steve Smith',
  'Kane Williamson',
  'AB de Villiers',
  'Chris Gayle',
  'Sachin Tendulkar',
  'Glenn McGrath',
  'Dale Steyn',
  'Muttiah Muralitharan',
  'Shane Warne',
  'Lasith Malinga',
  'Quinton de Kock',
  'Aiden Markram',
  'David Miller',
  'Jofra Archer',
]);

const KNOWN_OPENERS = new Set([
  'Rohit Sharma',
  'Shubman Gill',
  'Yashasvi Jaiswal',
  'David Warner',
  'Travis Head',
  'Virat Kohli',
  'Ruturaj Gaikwad',
  'Sai Sudharsan',
  'Prithvi Shaw',
  'Devdutt Padikkal',
  'Abhishek Sharma',
  'Virender Sehwag',
  'Sachin Tendulkar',
  'Chris Gayle',
  'Matthew Hayden',
  'Gautam Gambhir',
  'Shikhar Dhawan',
  'Aaron Finch',
  'Jason Roy',
  'Zak Crawley',
  'Ben Duckett',
  'Usman Khawaja',
  'Fakhar Zaman',
  'Saim Ayub',
  'Abdullah Shafique',
  'Imam-ul-Haq',
  'Sahibzada Farhan',
  'Pathum Nissanka',
  'Tamim Iqbal',
  'Ibrahim Zadran',
  'Finn Allen',
  'Reeza Hendricks',
  'Hashim Amla',
  'Graeme Smith',
  'Shaun Marsh',
  'Chris Lynn',
  'Will Jacks',
  'Alex Hales',
  'Dawid Malan',
  'James Vince',
  'Jake Fraser-McGurk',
  'Priyansh Arya',
  'Vaibhav Suryavanshi',
  'Sarel Erwee',
  'Jordan Hermann',
  'Brandon King',
]);

export function assignMarqueeSet(p: {
  name: string;
  primaryRole: string;
  bowlingStyle: string;
  battingRating: number;
  bowlingRating: number;
  formDelta?: number;
}): MarqueeSetName {
  const base =
    p.primaryRole === 'All-Rounder'
      ? Math.round(
          Math.max(p.battingRating, p.bowlingRating) * 0.6 +
            Math.min(p.battingRating, p.bowlingRating) * 0.4 +
            2
        )
      : Math.max(p.battingRating, p.bowlingRating);

  if (KNOWN_MARQUEE_STARS.has(p.name) || base >= 82) {
    return 'Marquee Stars';
  }
  if (p.primaryRole === 'Wicketkeeper') {
    return 'Wicketkeepers';
  }
  if (p.primaryRole === 'All-Rounder') {
    return 'All-Rounders';
  }
  if (p.primaryRole === 'Bowler') {
    const style = (p.bowlingStyle || '').toLowerCase();
    const isSpin =
      style.includes('break') ||
      style.includes('orthodox') ||
      style.includes('spin') ||
      style.includes('wrist');
    return isSpin ? 'Spinners' : 'Fast Bowlers';
  }
  if (KNOWN_OPENERS.has(p.name)) {
    return 'Opening Batters';
  }
  return 'Middle-Order Batters';
}

export function getHomeNationForCompetition(competition: LeagueCategory | string): string | null {
  switch (competition) {
    case 'IPL':
      return 'India';
    case 'PSL':
      return 'Pakistan';
    case 'SA20':
      return 'South Africa';
    case 'BBL':
      return 'Australia';
    case 'The Hundred':
      return 'England';
    case 'International':
    default:
      return null;
  }
}

export function isPlayerEligibleForCompetition(
  competition: LeagueCategory | string,
  player: { country: string; leagueOrigin: string },
  tier?: 'L' | 'M' | 'S' | 'D'
): boolean {
  const comp = (competition || 'IPL') as LeagueCategory;
  if (comp === 'IPL') {
    // Pakistan nationals never play in IPL
    if (player.country === 'Pakistan') return false;
    // Include all Indian players & IPL-tagged overseas players + top international stars (no random BBL/PSL/SA20 domestic bench)
    if (player.country === 'India' || player.leagueOrigin === 'IPL') return true;
    return tier === 'L' || tier === 'M';
  }
  if (comp === 'PSL') {
    // Active Indian players do not feature in PSL
    if (player.country === 'India') return false;
    if (player.country === 'Pakistan' || player.leagueOrigin === 'PSL') return true;
    return tier === 'L' || tier === 'M';
  }
  if (comp === 'SA20') {
    if (player.country === 'India') return false;
    if (player.country === 'South Africa' || player.leagueOrigin === 'SA20') return true;
    return tier === 'L' || tier === 'M';
  }
  if (comp === 'BBL') {
    if (player.country === 'India') return false;
    if (player.country === 'Australia' || player.leagueOrigin === 'BBL') return true;
    return tier === 'L' || tier === 'M';
  }
  if (comp === 'The Hundred') {
    if (player.country === 'India') return false;
    if (player.country === 'England' || player.leagueOrigin === 'The Hundred') return true;
    return tier === 'L' || tier === 'M';
  }
  // International: Full Member nation internationals & white-ball/red-ball stars
  return player.leagueOrigin === 'International' || tier === 'L' || tier === 'M';
}

export function shuffleAuctionPoolByMarqueeSet<
  T extends {
    id: number;
    marqueeSet?: string | null;
    name: string;
    primaryRole: string;
    bowlingStyle: string;
    battingRating: number;
    bowlingRating: number;
  },
>(playersList: T[], seed?: number): T[] {
  const rand =
    typeof seed === 'number'
      ? mulberry32(seed)
      : mulberry32(Math.floor(Date.now() ^ (Math.random() * 0xffffffff)));

  const buckets = new Map<string, T[]>();
  for (const setName of MARQUEE_SET_ORDER) {
    buckets.set(setName, []);
  }

  for (const p of playersList) {
    const resolvedSet =
      p.marqueeSet && buckets.has(p.marqueeSet)
        ? p.marqueeSet
        : assignMarqueeSet(p);
    buckets.get(resolvedSet)!.push(p);
  }

  const result: T[] = [];
  for (const setName of MARQUEE_SET_ORDER) {
    const bucket = buckets.get(setName)!;
    // Fisher-Yates chance shuffle INSIDE the Marquee Set
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = bucket[i];
      bucket[i] = bucket[j];
      bucket[j] = tmp;
    }
    result.push(...bucket);
  }
  return result;
}

export interface RealPlayerRow {
  leagueId: number;
  name: string;
  country: string;
  leagueOrigin: LeagueCategory;
  isOverseas: boolean;
  age: number;
  battingHand: string;
  bowlingStyle: string;
  primaryRole: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper';
  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;
  fitness: number;
  consistency: number;
  temperament: number;
  potential: number;
  currentForm: number;
  morale: number;
  basePrice: number;
  marketValue: number;
  isGenerated: boolean;
  sourceLabel: string;
  injuryStatus: string;
  marqueeSet: MarqueeSetName;
  formDelta: number;
  statsJson: {
    t20: {
      matches: number;
      runs: number;
      battingAvg: number;
      strikeRate: number;
      hundreds: number;
      fifties: number;
      wickets: number;
      economy: number;
      bowlingAvg: number;
      bestBowling: string;
    };
    odi: {
      matches: number;
      runs: number;
      battingAvg: number;
      strikeRate: number;
      hundreds: number;
      fifties: number;
      wickets: number;
      economy: number;
      bowlingAvg: number;
      bestBowling: string;
    };
    test: {
      matches: number;
      runs: number;
      battingAvg: number;
      strikeRate: number;
      hundreds: number;
      fifties: number;
      wickets: number;
      economy: number;
      bowlingAvg: number;
      bestBowling: string;
    };
  };
}

export function buildRealCricketPlayerPool(
  leagueId: number,
  defaultBasePrice = 50,
  competition?: LeagueCategory | string
): RealPlayerRow[] {
  const rand = mulberry32(leagueId * 7919 + 2027);
  const seen = new Set<string>();
  const allTuples: CompactPlayerTuple[] = [];

  for (const t of CURATED_REAL_PLAYERS) {
    const key = t[0].trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      if (
        !competition ||
        isPlayerEligibleForCompetition(competition, { country: t[1], leagueOrigin: t[2] }, t[4])
      ) {
        allTuples.push(t);
      }
    }
  }

  const roleMap: Record<
    'BAT' | 'BWL' | 'AR' | 'WK',
    'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper'
  > = {
    BAT: 'Batsman',
    BWL: 'Bowler',
    AR: 'All-Rounder',
    WK: 'Wicketkeeper',
  };

  const homeNation = competition ? getHomeNationForCompetition(competition) : 'India';

  const rows: RealPlayerRow[] = allTuples.map(
    ([name, country, leagueOrigin, roleCode, tier, age, batHand, bowlType]) => {
      const role = roleMap[roleCode];

      // Realistic CM27 OVR scaling (~52 to 89 max): IPL & international marquee stars clearly outrank domestic-only players
      const baseMin = tier === 'L' ? 83 : tier === 'M' ? 74 : tier === 'S' ? 64 : 54;
      const baseSpan = tier === 'L' ? 5 : tier === 'M' ? 6 : tier === 'S' ? 6 : 6;
      const isMarqueeStar = KNOWN_MARQUEE_STARS.has(name);
      const isIplProven = leagueOrigin === 'IPL';
      const pedigreeAdj = isMarqueeStar
        ? 2
        : isIplProven && (tier === 'L' || tier === 'M')
          ? 2
          : !isIplProven && tier !== 'L'
            ? -3
            : 0;

      const ageAdj = age >= 38 ? -2 : age >= 35 ? -1 : age <= 19 ? -1 : 0;

      let battingRating = 42;
      let bowlingRating = 32;
      let fieldingRating = clamp(62 + (tier === 'L' ? 12 : tier === 'M' ? 7 : 0) + rand() * 14, 52, 89);

      if (role === 'Batsman') {
        battingRating = clamp(baseMin + pedigreeAdj + ageAdj + rand() * baseSpan, 50, 89);
        bowlingRating = clamp(18 + rand() * 28, 14, 52);
      } else if (role === 'Wicketkeeper') {
        battingRating = clamp(baseMin - 1 + pedigreeAdj + ageAdj + rand() * baseSpan, 50, 88);
        bowlingRating = clamp(12 + rand() * 10, 10, 26);
        fieldingRating = clamp(72 + (tier === 'L' ? 8 : 3) + rand() * 12, 65, 90);
      } else if (role === 'Bowler') {
        battingRating = clamp(22 + rand() * 28, 15, 56);
        bowlingRating = clamp(baseMin + pedigreeAdj + ageAdj + rand() * baseSpan, 50, 89);
      } else {
        battingRating = clamp(baseMin - 2 + pedigreeAdj + ageAdj + rand() * (baseSpan + 1), 49, 86);
        bowlingRating = clamp(baseMin - 2 + pedigreeAdj + ageAdj + rand() * (baseSpan + 1), 49, 86);
      }

      if (isMarqueeStar) {
        if (role === 'Batsman' || role === 'Wicketkeeper') battingRating = Math.max(battingRating, 83);
        else if (role === 'Bowler') bowlingRating = Math.max(bowlingRating, 83);
        else {
          battingRating = Math.max(battingRating, 80);
          bowlingRating = Math.max(bowlingRating, 79);
        }
      }

      const currentForm = clamp(
        (tier === 'L' ? 66 : tier === 'M' ? 61 : tier === 'S' ? 56 : 54) + rand() * 28,
        46,
        92
      );
      const formDelta = clamp(Math.round((currentForm - 70) / 10), -2, 2);

      const baseOvr =
        role === 'All-Rounder'
          ? clamp(
              Math.max(battingRating, bowlingRating) * 0.6 +
                Math.min(battingRating, bowlingRating) * 0.4 +
                2,
              48,
              89
            )
          : clamp(Math.max(battingRating, bowlingRating), 48, 89);

      let overall = clamp(baseOvr + formDelta, 48, 90);
      if (!isIplProven && !isMarqueeStar && tier !== 'L') {
        overall = Math.min(overall, 79);
        if (role === 'Batsman' || role === 'Wicketkeeper') battingRating = Math.min(battingRating, 79);
        if (role === 'Bowler') bowlingRating = Math.min(bowlingRating, 79);
      }

      const fitness = clamp(70 + (age <= 29 ? 8 : -2) + rand() * 18, 60, 95);
      const consistency = clamp(baseOvr - 4 + rand() * 9, 48, 90);
      const temperament = clamp(baseOvr - 3 + (age > 28 ? 4 : 0) + rand() * 7, 48, 90);
      const potential = clamp(
        age <= 22 ? baseOvr + 9 + rand() * 10 : age <= 26 ? baseOvr + 3 + rand() * 6 : baseOvr,
        baseOvr,
        90
      );
      const morale = clamp(62 + rand() * 26, 54, 92);

      const basePrice =
        overall >= 82
          ? Math.max(defaultBasePrice, 200)
          : overall >= 76
            ? Math.max(defaultBasePrice, 150)
            : overall >= 68
              ? Math.max(defaultBasePrice, 100)
              : overall >= 60
                ? Math.max(defaultBasePrice, 50)
                : Math.min(defaultBasePrice, 30);

      const marketValue = Math.round(basePrice * (1.8 + Math.max(0, overall - 55) * 0.14));

      const marqueeSet = assignMarqueeSet({
        name,
        primaryRole: role,
        bowlingStyle: bowlType,
        battingRating,
        bowlingRating,
        formDelta,
      });

      // Authentic career stats grounded in league tier, role, age & form
      const tierFactor = tier === 'L' ? 1.0 : tier === 'M' ? 0.78 : tier === 'S' ? 0.56 : 0.34;
      const careerYears = Math.max(1, age - 18);

      const makeFormatStats = (format: 't20' | 'odi' | 'test') => {
        const fmtMult = format === 't20' ? 1.0 : format === 'odi' ? 0.65 : 0.36;
        const baseMatchRate = tier === 'L' ? 9.5 : tier === 'M' ? 6.8 : tier === 'S' ? 4.2 : 2.1;
        const matches = Math.max(
          tier === 'D' ? 4 : 10,
          Math.round(careerYears * baseMatchRate * fmtMult * (0.78 + rand() * 0.44))
        );

        const batSkill = clamp((battingRating - 40) / 50, 0.08, 1);
        const bowlSkill = clamp((bowlingRating - 40) / 50, 0.08, 1);

        let battingAvg = 0;
        let strikeRate = 0;
        if (role === 'Bowler') {
          battingAvg = Number((7.5 + batSkill * 11 + (rand() - 0.5) * 3.5).toFixed(1));
          strikeRate = Number(
            (format === 't20'
              ? 88 + batSkill * 38
              : format === 'odi'
                ? 62 + batSkill * 24
                : 34 + batSkill * 18
            ).toFixed(1)
          );
        } else {
          const avgBase =
            format === 't20'
              ? 16 + batSkill * 22
              : format === 'odi'
                ? 21 + batSkill * 30
                : 20 + batSkill * 32;
          battingAvg = Number((avgBase + formDelta * 0.6 + (rand() - 0.5) * 4.5).toFixed(1));
          strikeRate =
            format === 't20'
              ? Number((114 + batSkill * 38 + (rand() - 0.5) * 11).toFixed(1))
              : format === 'odi'
                ? Number((73 + batSkill * 28 + (rand() - 0.5) * 8).toFixed(1))
                : Number((43 + batSkill * 22 + (rand() - 0.5) * 7).toFixed(1));
        }

        const inningsEst = Math.max(1, Math.round(matches * (role === 'Bowler' ? 0.45 : 0.88)));
        const notOutShare = role === 'Bowler' ? 0.35 : 0.14;
        const runs = Math.max(
          0,
          Math.round(inningsEst * (1 - notOutShare) * battingAvg * (0.9 + rand() * 0.18))
        );
        const hundreds =
          role === 'Bowler'
            ? 0
            : format === 't20'
              ? Math.floor((runs / 2400) * batSkill * tierFactor)
              : Math.floor((runs / 820) * batSkill * (0.85 + tierFactor * 0.4));
        const fifties =
          role === 'Bowler'
            ? rand() > 0.85 && runs > 300
              ? 1
              : 0
            : Math.floor((runs / (format === 't20' ? 420 : 320)) * (0.7 + batSkill * 0.4));

        const bowls =
          bowlType !== 'None' && (role === 'Bowler' || role === 'All-Rounder');
        const wickets = bowls
          ? Math.max(
              1,
              Math.round(
                matches *
                  (role === 'Bowler' ? 1.12 : 0.58) *
                  (0.55 + bowlSkill * 0.6) *
                  (format === 'test' ? 1.95 : 1.0)
              )
            )
          : 0;

        const economy =
          wickets > 0
            ? Number(
                (
                  (format === 't20' ? 9.15 : format === 'odi' ? 6.05 : 3.95) -
                  bowlSkill * (format === 't20' ? 2.15 : format === 'odi' ? 1.3 : 0.85) +
                  (rand() - 0.5) * 0.35
                ).toFixed(2)
              )
            : 0;
        const bowlingAvg =
          wickets > 0
            ? Number(
                (
                  (format === 't20' ? 32.5 : format === 'odi' ? 36.0 : 37.5) -
                  bowlSkill * 13.5 +
                  (rand() - 0.5) * 3.5
                ).toFixed(1)
              )
            : 0;
        const bestW =
          wickets > 0
            ? clamp(
                (format === 'test' ? 4 : 3) + Math.round(bowlSkill * 2.2),
                1,
                format === 'test' ? 7 : 6
              )
            : 0;
        const bestR = wickets > 0 ? clamp(14 + Math.round((1 - bowlSkill) * 24 + rand() * 8), 8, 52) : 0;

        return {
          matches,
          runs,
          battingAvg,
          strikeRate,
          hundreds,
          fifties,
          wickets,
          economy,
          bowlingAvg,
          bestBowling: wickets > 0 ? `${bestW}/${bestR}` : '-',
        };
      };

      const isOverseas = homeNation ? country !== homeNation : false;

      return {
        leagueId,
        name,
        country,
        leagueOrigin,
        isOverseas,
        age,
        battingHand: batHand === 'L' ? 'Left-hand' : 'Right-hand',
        bowlingStyle: bowlType,
        primaryRole: role,
        battingRating,
        bowlingRating,
        fieldingRating,
        fitness,
        consistency,
        temperament,
        potential,
        currentForm,
        morale,
        basePrice,
        marketValue,
        isGenerated: false,
        sourceLabel: `CM27 ${leagueOrigin} Registry`,
        injuryStatus: 'Fit',
        marqueeSet,
        formDelta,
        statsJson: {
          t20: makeFormatStats('t20'),
          odi: makeFormatStats('odi'),
          test: makeFormatStats('test'),
        },
      };
    }
  );

  rows.sort((a, b) => {
    const oa =
      a.primaryRole === 'All-Rounder'
        ? Math.max(a.battingRating, a.bowlingRating) * 0.6 +
          Math.min(a.battingRating, a.bowlingRating) * 0.4 +
          2 +
          a.formDelta
        : Math.max(a.battingRating, a.bowlingRating) + a.formDelta;
    const ob =
      b.primaryRole === 'All-Rounder'
        ? Math.max(b.battingRating, b.bowlingRating) * 0.6 +
          Math.min(b.battingRating, b.bowlingRating) * 0.4 +
          2 +
          b.formDelta
        : Math.max(b.battingRating, b.bowlingRating) + b.formDelta;
    return ob - oa;
  });

  return rows;
}

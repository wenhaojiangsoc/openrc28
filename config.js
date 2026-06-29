/*
 * OpenRC28 web app configuration + shared data.
 *
 * Fill in your Supabase project values to enable cloud saving. If left blank,
 * the app still works for demos: data is kept in the browser (localStorage) only.
 *   Project Settings > API > Project URL  -> SUPABASE_URL
 *   Project Settings > API > anon public  -> SUPABASE_ANON_KEY
 */
const CONFIG = {
  SUPABASE_URL: 'https://pcpnetuwxbyypzjakolf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_ofb7WfjVBymM9RtKHaobjA_cRLC3mzJ', // publishable key (safe to be public)
};

const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary', 'Other'];
const RACE_OPTIONS = ['White', 'Black', 'East Asian', 'South Asian', 'MENA', 'Other'];
const HISPANIC_OPTIONS = ['Yes', 'No'];
const CAREER_OPTIONS = ['Graduate Student', 'Postdoc', 'Assistant Professor', 'Associate Professor', 'Full Professor', 'Other'];

const RESEARCH_TOPIC_GROUPS = [
  { category: 'Inequality & Mobility', topics: ['Social mobility', 'Income inequality', 'Wealth & assets', 'Poverty', 'Intergenerational transmission'] },
  { category: 'Identity', topics: ['Race & ethnicity', 'Gender', 'Social class'] },
  { category: 'Demography & Population', topics: ['Immigration & migration', 'Health & mortality', 'Fertility & population'] },
  { category: 'Education', topics: ['Educational attainment', 'Schools & achievement', 'Higher education'] },
  { category: 'Work & Labor', topics: ['Labor markets', 'Occupations & professions', 'Wages & employment', 'Organizations & workplaces'] },
  { category: 'Family', topics: ['Family & households', 'Marriage & partnership', 'Children & parenting'] },
  { category: 'Methods & Statistics', topics: ['Causal inference', 'Quantitative methods', 'Computational & big data', 'Qualitative methods', 'Social network analysis'] },
];

// Treatment = odd badge number.
function isTreatment(badgeId) {
  const digits = String(badgeId).replace(/\D/g, '');
  if (!digits) return false;
  return parseInt(digits, 10) % 2 === 1;
}

// Mock attendee directory (stands in for the server result, as in the native app).
const MOCK_CANDIDATES = [
  { id: 'p21', name: 'Dr. Amara Okafor', affiliation: 'Princeton (Professor)', email: 'a.okafor@princeton.edu', topics: ['Social mobility', 'Race & ethnicity', 'Educational attainment'], diversityDistance: 4 },
  { id: 'p34', name: 'Kenji Tanaka', affiliation: 'UC Berkeley (PhD student)', email: 'k.tanaka@berkeley.edu', topics: ['Labor markets', 'Income inequality', 'Causal inference'], diversityDistance: 3 },
  { id: 'p08', name: 'Dr. Sofia Rossi', affiliation: 'Bocconi (Associate Professor)', email: 's.rossi@unibocconi.it', topics: ['Gender', 'Occupations & professions', 'Labor markets'], diversityDistance: 3 },
  { id: 'p52', name: 'Dr. Robert Hale', affiliation: 'Wisconsin–Madison (Professor)', email: 'rhale@wisc.edu', topics: ['Income inequality', 'Wealth & assets', 'Intergenerational transmission'], diversityDistance: 2 },
  { id: 'p47', name: 'Mei Lin Chua', affiliation: 'NUS (PhD student)', email: 'meilin@nus.edu.sg', topics: ['Immigration & migration', 'Race & ethnicity', 'Family & households'], diversityDistance: 4 },
  { id: 'p15', name: 'Dr. David Cohen', affiliation: 'Hebrew University (Assistant Professor)', email: 'd.cohen@huji.ac.il', topics: ['Educational attainment', 'Social mobility', 'Poverty'], diversityDistance: 2 },
  { id: 'p63', name: 'Dr. Fatima Al-Sayed', affiliation: 'Oxford (Postdoc)', email: 'fatima.alsayed@ox.ac.uk', topics: ['Health & mortality', 'Gender', 'Quantitative methods'], diversityDistance: 4 },
  { id: 'p29', name: 'Lucas Almeida', affiliation: 'USP São Paulo (PhD student)', email: 'l.almeida@usp.br', topics: ['Poverty', 'Income inequality', 'Social mobility'], diversityDistance: 3 },
];

// RC28 Summer Meeting 2026 — Program at a Glance (full detail in program.pdf).
const SCHEDULE = [
  { day: 'Tuesday, Aug 4', items: [
    { time: '5:00–7:00 pm', title: 'Welcome Reception', loc: 'NYU Department of Sociology', kind: 'reception' },
  ]},
  { day: 'Wednesday, Aug 5', items: [
    { time: '8:30 am', title: 'Registration', loc: 'Kimmel Center', kind: 'info' },
    { time: '9:00–10:30 am', title: 'Keynote: Adam Gamoran', loc: 'KC Eisner & Lubin', kind: 'keynote' },
    { time: '10:30 am', title: 'Coffee Break', kind: 'break' },
    { time: '11:00 am', title: 'Sessions 1A–1F', loc: 'KC 903–914', kind: 'session' },
    { time: '12:30 pm', title: 'Lunch', kind: 'break' },
    { time: '1:30 pm', title: 'Sessions 2A–2F', loc: 'KC 903–914', kind: 'session' },
    { time: '3:00 pm', title: 'Coffee Break', kind: 'break' },
    { time: '3:30 pm', title: 'Sessions 3A–3F', loc: 'KC 903–914', kind: 'session' },
    { time: '5:00 pm', title: 'Poster Session & Reception', kind: 'reception' },
  ]},
  { day: 'Thursday, Aug 6', items: [
    { time: '8:30 am', title: 'Sessions 4A–4F', loc: 'KC 903–914', kind: 'session' },
    { time: '10:00 am', title: 'Coffee Break', kind: 'break' },
    { time: '10:30 am', title: 'Sessions 5A–5F', loc: 'KC 903–914', kind: 'session' },
    { time: '12:00 pm', title: 'Lunch', kind: 'break' },
    { time: '1:00 pm', title: 'Sessions 6A–6F', loc: 'KC 903–914', kind: 'session' },
    { time: '2:30 pm', title: 'Coffee Break', kind: 'break' },
    { time: '2:45 pm', title: 'Sessions 7A–7F', loc: 'KC 903–914', kind: 'session' },
    { time: '5:30 pm', title: 'Conference Dinner', kind: 'reception' },
  ]},
  { day: 'Friday, Aug 7', items: [
    { time: '9:00 am', title: 'IPM–RC28 Joint Keynote Panel', loc: 'GC Grand Hall', kind: 'keynote' },
    { time: '10:00 am', title: 'Coffee Break', kind: 'break' },
    { time: '11:00 am', title: 'Sessions 8A–8F', loc: 'KC 903–914', kind: 'session' },
    { time: '12:30 pm', title: 'Lunch', kind: 'break' },
    { time: '1:30 pm', title: 'Sessions 9A–9F', loc: 'KC 903–914', kind: 'session' },
    { time: '3:00 pm', title: 'Closing', kind: 'info' },
  ]},
];

const VENUE = {
  name: 'NYU Kimmel Center for University Life',
  address: '60 Washington Square S, New York, NY 10012',
  rooms: 'Parallel sessions A–F meet in KC 903, 905, 907, 909, 912 & 914. Wednesday keynote: KC Eisner & Lubin. Friday joint panel: GC Grand Hall.',
  mapsUrl: 'https://maps.apple.com/?q=NYU%20Kimmel%20Center,%2060%20Washington%20Square%20S,%20New%20York,%20NY%2010012',
};

// Rank candidates: share >=1 topic, ordered by sharedTopics x (1 + diversityDistance).
function rankMatches(myTopics) {
  const mine = new Set(myTopics);
  return MOCK_CANDIDATES
    .map((c) => {
      const sharedTopics = c.topics.filter((t) => mine.has(t));
      return { ...c, sharedTopics, score: sharedTopics.length * (1 + c.diversityDistance) };
    })
    .filter((m) => m.sharedTopics.length > 0)
    .sort((a, b) => b.score - a.score);
}

/* OpenRC28 web app — onboarding + tabbed app (Program / Map / Match / More). */

const CONSENT_ITEMS = [
  ['🔵', 'What we do', 'Your badge senses who is nearby and detects when you speak, never what you say.'],
  ['📄', 'What we collect', 'Proximity, speaking activity (no audio), and your demographics.'],
  ['❤️', 'Risks & benefits', 'Minimal risk. You help make conferences more inclusive and may meet scholars who share your interests.'],
  ['🔒', 'Data security', 'Stored under your anonymous badge ID. Your name is never recorded for the main study.'],
  ['✋', 'Your rights', 'Participation is voluntary. You may withdraw anytime by returning your badge.'],
];

let consentOk = false;
let selectedTopics = new Set();
let reg = null;          // { badge, gender, race, hispanic, career }
let match = null;        // { name, affiliation, topics, arm }
let currentTab = 'program';
let matchPhase = 'intro'; // 'intro' | 'profile' (only when not yet joined)
let revealed = new Set();
let programView = 'schedule'; // 'schedule' | 'session'
let currentSession = null;
let searchQuery = '';
let moreView = 'list'; // 'list' | 'consent' | 'about' | 'contact'

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- helpers ----------
function go(id) {
  document.getElementById('tabbar').classList.add('hidden');
  document.getElementById('a2hs').classList.add('hidden');
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}
function showMain(tab) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById('main').classList.add('active');
  document.getElementById('tabbar').classList.remove('hidden');
  setTab(tab || currentTab);
  maybeShowA2HS();
}
function setTab(name) {
  currentTab = name;
  programView = 'schedule'; moreView = 'list'; searchQuery = ''; // reset sub-views on tab tap
  document.querySelectorAll('#tabbar button').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === name));
  render();
  window.scrollTo(0, 0);
}
function setContent(html) { document.getElementById('tab-content').innerHTML = html; }
function fillSelect(id, opts) {
  document.getElementById(id).innerHTML =
    '<option value="" disabled selected>Select…</option>' + opts.map((o) => `<option>${o}</option>`).join('');
}
function cloudOn() { return !!CONFIG.SUPABASE_URL && !!CONFIG.SUPABASE_ANON_KEY; }
async function sb(table, row) {
  if (!cloudOn()) return;
  try {
    await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify([row]),
    });
  } catch (e) {}
}

// ---------- onboarding ----------
function renderConsentList(elId) {
  document.getElementById(elId).innerHTML = CONSENT_ITEMS.map(
    ([ico, label, text]) =>
      `<div class="row"><div class="ico">${ico}</div><div><div class="rlabel">${label}</div><div class="rtext">${text}</div></div></div>`
  ).join('');
}
function toggleConsent() {
  consentOk = !consentOk;
  const c = document.getElementById('consent-check');
  c.classList.toggle('on', consentOk);
  c.querySelector('.box').textContent = consentOk ? '✓' : '';
  document.getElementById('consent-next').disabled = !consentOk;
}
async function submitRegister() {
  const badge = document.getElementById('badge').value.trim();
  const gender = document.getElementById('gender').value;
  const race = document.getElementById('race').value;
  const hispanic = document.getElementById('hispanic').value;
  const career = document.getElementById('career').value;
  if (!badge || !gender || !race || !hispanic || !career) { alert('Please fill in every field.'); return; }
  reg = { badge, gender, race, hispanic, career };
  localStorage.setItem('reg', JSON.stringify(reg));
  await sb('participants', { badge_id: badge, gender, race, hispanic, career_stage: career });
  showMain('program');
}

// ---------- tab renderers ----------
function render() {
  if (currentTab === 'program') return renderProgram();
  if (currentTab === 'map') return renderMap();
  if (currentTab === 'match') return renderMatch();
  if (currentTab === 'more') return renderMore();
}

function renderProgram() {
  if (programView === 'session' && currentSession) return renderSessionDetail(currentSession);

  const days = SCHEDULE.map((d) => `
    <h2>${d.day}</h2>
    <div class="card sched">
      ${d.items.map((it) => {
        if ((it.kind || '') === 'session') {
          const n = (it.title.match(/(\d)/) || [])[1];
          const subs = SESSIONS.filter((s) => s.id.startsWith(n));
          return `<div class="sitem k-session"><div class="stime">${it.time}</div><div class="sbody" style="flex:1">${
            subs.map((s) => `<div class="srow" onclick="openSession('${s.id}')"><div class="sid">${s.id}</div><div style="flex:1;min-width:0"><div class="stitle">${escapeHtml(s.title)}</div><div class="sloc">${s.room}</div></div><span class="chev">›</span></div>`).join('')
          }</div></div>`;
        }
        return `<div class="sitem k-${it.kind || 'session'}"><div class="stime">${it.time}</div><div class="sbody"><div class="stitle">${it.title}</div>${it.loc ? `<div class="sloc">${it.loc}</div>` : ''}</div></div>`;
      }).join('')}
    </div>`).join('');

  setContent(`
    <h1>Welcome to RC28</h1>
    <p class="sub">NYU · Aug 4–7, 2026</p>
    <div class="nudge">
      <div class="nudge-title">Conferences are about people</div>
      <div class="nudge-text">The best part of RC28 is who you meet. Open Match to discover scholars who share your interests, and reach out to say hello.</div>
      <button class="btn" style="background:#fff;color:var(--brown);margin-top:12px" onclick="setTab('match')">Open Match →</button>
    </div>
    <input id="psearch" class="search" placeholder="Search papers or authors…" oninput="onSearch(this.value)" value="${escapeHtml(searchQuery)}" />
    <div id="presults"></div>
    <div id="pschedule">
      ${days}
      <a class="btn outline" style="display:block;text-align:center;text-decoration:none;margin-top:8px" href="program.pdf" target="_blank" rel="noopener">Full program (PDF) ↗</a>
    </div>
  `);
  if (searchQuery.trim()) onSearch(searchQuery);
}

function onSearch(q) {
  searchQuery = q;
  const res = document.getElementById('presults');
  const sched = document.getElementById('pschedule');
  if (!res || !sched) return;
  const query = q.trim().toLowerCase();
  if (!query) { res.innerHTML = ''; sched.style.display = ''; return; }
  sched.style.display = 'none';
  const hits = [];
  for (const s of SESSIONS) for (const p of s.papers) {
    if (p.authors.toLowerCase().includes(query) || p.title.toLowerCase().includes(query) || s.title.toLowerCase().includes(query)) hits.push({ s, p });
  }
  if (!hits.length) { res.innerHTML = `<div class="card"><div class="rtext">No matches for “${escapeHtml(q)}”.</div></div>`; return; }
  res.innerHTML = `<p class="sub">${hits.length} result${hits.length > 1 ? 's' : ''}</p>` + hits.slice(0, 100).map(({ s, p }) =>
    `<div class="match" onclick="openSession('${s.id}')"><div class="name" style="font-size:14.5px">${escapeHtml(p.title)}</div><div class="affil">${escapeHtml(p.authors)}</div><div class="tag" style="display:inline-block;margin-top:8px">${s.id} · ${escapeHtml(s.title)}</div></div>`).join('');
}

function openSession(id) { programView = 'session'; currentSession = id; render(); }
function backToSchedule() { programView = 'schedule'; render(); }

function renderSessionDetail(id) {
  const s = SESSIONS.find((x) => x.id === id);
  if (!s) { backToSchedule(); return; }
  setContent(`
    <button class="back" style="text-align:left;margin:0 0 8px" onclick="backToSchedule()">← Schedule</button>
    <h1 style="font-size:23px">Session ${s.id}</h1>
    <p class="sub">${escapeHtml(s.title)}<br>${s.room} · ${s.day} ${s.time}</p>
    ${s.papers.map((p) => `<div class="card"><div class="rlabel" style="font-size:14.5px;line-height:1.35">${escapeHtml(p.title)}</div><div class="rtext" style="margin-top:5px">${escapeHtml(p.authors)}</div></div>`).join('')}
  `);
}

function renderMap() {
  setContent(`<h1>Map</h1><div class="card"><div class="placeholder">🗺️<div>Coming soon.</div></div></div>`);
}

function renderMatch() {
  if (!match) {
    if (matchPhase === 'profile') return renderMatchProfile();
    return renderMatchIntro();
  }
  if (match.arm === 'treatment') return renderMatches();
  return renderWaitlist();
}

function renderMatchIntro() {
  setContent(`
    <div class="center" style="min-height:70vh">
      <div class="logo"><div class="dot top"></div><div class="dot bot"></div></div>
      <h1>Find Your People</h1>
      <p class="sub">Discover scholars who share your interests and reach out to connect.</p>
      <div class="note">Your name, affiliation, and interests are used only to match you with other opted-in scholars, never for our research, and are deleted after the conference.</div>
      <button class="btn" onclick="matchPhase='profile';renderMatch()">Opt In to Match</button>
    </div>
  `);
}

function renderMatchProfile() {
  setContent(`
    <div class="steplabel">Match · Your Profile</div>
    <h1>Your Profile</h1>
    <label class="field"><span class="l">Full Name</span><input id="m-name" placeholder="e.g. Jane Smith" value="${match?.name || ''}" /></label>
    <label class="field"><span class="l">Affiliation</span><input id="m-affil" placeholder="e.g. Duke University" value="${match?.affiliation || ''}" /></label>
    <span class="l" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Research Interests</span>
    <div class="card" id="topics" style="padding:4px 12px"></div>
    <button class="btn" onclick="joinMatch()">Find My Matches</button>
    <button class="back" onclick="matchPhase='intro';renderMatch()">&larr; Back</button>
  `);
  renderTopics();
}

function renderTopics() {
  const host = document.getElementById('topics');
  if (!host) return;
  host.innerHTML = RESEARCH_TOPIC_GROUPS.map((g, gi) => {
    const open = gi === 0;
    const items = g.topics.map((t) => {
      const sel = selectedTopics.has(t) ? 'sel' : '';
      return `<div class="topic ${sel}" onclick="toggleTopic('${t.replace(/'/g, "\\'")}')"><span>${t}</span><span class="mark">${selectedTopics.has(t) ? '●' : '○'}</span></div>`;
    }).join('');
    const n = g.topics.filter((t) => selectedTopics.has(t)).length;
    return `<div><div class="acc-head" onclick="toggleGroup(${gi})"><span>${g.category}</span><span>${n ? `<span class="chip-pill">${n}</span> ` : ''}<span class="chev" data-g="${gi}">${open ? '▲' : '▼'}</span></span></div><div class="acc-body" data-body="${gi}" style="${open ? '' : 'display:none'}">${items}</div></div>`;
  }).join('');
}
function toggleGroup(gi) {
  const body = document.querySelector(`[data-body="${gi}"]`);
  const chev = document.querySelector(`.chev[data-g="${gi}"]`);
  const show = body.style.display === 'none';
  body.style.display = show ? '' : 'none';
  if (chev) chev.textContent = show ? '▲' : '▼';
}
function toggleTopic(t) {
  if (selectedTopics.has(t)) selectedTopics.delete(t); else selectedTopics.add(t);
  renderTopics();
}

async function joinMatch() {
  const name = document.getElementById('m-name').value.trim();
  const affil = document.getElementById('m-affil').value.trim();
  const topics = [...selectedTopics];
  if (!name || !affil || topics.length === 0) { alert('Please add your name, affiliation, and at least one interest.'); return; }
  const arm = isTreatment(reg.badge) ? 'treatment' : 'control';
  match = { name, affiliation: affil, topics, arm };
  localStorage.setItem('match', JSON.stringify(match));
  await sb('match_profiles', { badge_id: reg.badge, name, affiliation: affil, interests: topics, arm });
  renderMatch();
}

function renderMatches() {
  const list = rankMatches(match.topics);
  const cards = list.length === 0
    ? `<div class="card"><div class="rtext">No matches yet. Add more interests in your profile to find people.</div></div>`
    : list.map((m) => `
      <div class="match">
        <div class="head"><div class="avatar">${m.name.charAt(0)}</div><div><div class="name">${m.name}</div><div class="affil">${m.affiliation}</div></div></div>
        <div class="tags">${m.sharedTopics.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        <button class="btn outline" style="margin-top:0" onclick="toggleEmail('${m.id}')">Email</button>
        <div class="email ${revealed.has(m.id) ? '' : 'hidden'}">${m.email}</div>
      </div>`).join('');
  setContent(`<h1>Match</h1><p class="sub">Scholars to meet at RC28</p>${cards}`);
}
function toggleEmail(id) {
  if (revealed.has(id)) revealed.delete(id); else revealed.add(id);
  renderMatches();
}

function renderWaitlist() {
  setContent(`
    <div class="center" style="min-height:70vh">
      <div style="font-size:54px">⏳</div>
      <h1>You're in!</h1>
      <p class="sub">We're finding scholars who share your interests. Your matches will appear here soon. Check back during the conference.</p>
    </div>
  `);
}

function openMore(v) { moreView = v; render(); }
function backToMore() { moreView = 'list'; render(); }

function moreDetail(title, body) {
  setContent(`<button class="back" style="text-align:left;margin:0 0 8px" onclick="backToMore()">← More</button><h1 style="font-size:23px">${title}</h1>${body}`);
}

function renderMore() {
  if (moreView === 'consent') {
    const consent = CONSENT_ITEMS.map(([ico, label, text]) =>
      `<div class="row"><div class="ico">${ico}</div><div><div class="rlabel">${label}</div><div class="rtext">${text}</div></div></div>`).join('');
    return moreDetail('Consent & Privacy',
      `<div class="card">${consent}</div><div class="note">No audio is ever recorded. Your badge data stays on the badge. Demographics are stored under your badge ID only and used for research only.</div>`);
  }
  if (moreView === 'about') {
    return moreDetail('About the Study',
      `<div class="card"><div class="rtext">The Open Conference Lab studies how scholars connect at academic conferences, to help make them more inclusive. This study uses a sociometric badge and this app to understand interaction patterns and to test a matchmaking feature. Led by Siwei Cheng (New York University) and Wenhao Jiang (Duke University).</div></div>`);
  }
  if (moreView === 'contact') {
    return moreDetail('Contact',
      `<div class="card"><div class="rtext">Questions about the study? Reach the research team at the registration desk, or by the email listed on your consent form.</div></div>`);
  }
  setContent(`
    <h1>More</h1>
    <p class="sub">Study info & settings</p>
    <div class="card menu">
      <div class="mrow" onclick="openMore('consent')"><span class="ico">🔒</span><span class="ml">Consent & Privacy</span><span class="chev">›</span></div>
      <div class="mrow" onclick="openMore('about')"><span class="ico">ℹ️</span><span class="ml">About the Study</span><span class="chev">›</span></div>
      <div class="mrow" onclick="openMore('contact')"><span class="ico">✉️</span><span class="ml">Contact</span><span class="chev">›</span></div>
    </div>
    <button class="back" onclick="signOut()" style="margin-top:24px">Reset / sign out</button>
  `);
}

function signOut() {
  localStorage.removeItem('reg');
  localStorage.removeItem('match');
  reg = null; match = null; selectedTopics = new Set(); consentOk = false; matchPhase = 'intro'; revealed = new Set();
  const c = document.getElementById('consent-check');
  c.classList.remove('on'); c.querySelector('.box').textContent = '';
  document.getElementById('consent-next').disabled = true;
  go('welcome');
}

// ---------- install / add-to-home-screen ----------
let deferredPrompt = null;
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function maybeShowA2HS() {
  if (isStandalone() || localStorage.getItem('a2hs_dismissed')) return;
  const banner = document.getElementById('a2hs');
  const text = document.getElementById('a2hs-text');
  const act = document.getElementById('a2hs-act');
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (deferredPrompt) {
    text.textContent = 'Add OpenRC28 to your home screen.';
    act.textContent = 'Install';
    act.classList.remove('hidden');
    act.onclick = async () => { banner.classList.add('hidden'); deferredPrompt.prompt(); deferredPrompt = null; };
    banner.classList.remove('hidden');
  } else if (isIOS) {
    text.innerHTML = 'Add to Home Screen: tap Share, then “Add to Home Screen.”';
    act.classList.add('hidden');
    banner.classList.remove('hidden');
  }
}
function dismissA2HS() {
  document.getElementById('a2hs').classList.add('hidden');
  localStorage.setItem('a2hs_dismissed', '1');
}
function setupInstall() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (document.getElementById('main').classList.contains('active')) maybeShowA2HS();
  });
}

// ---------- init ----------
(function init() {
  setupInstall();
  fillSelect('gender', GENDER_OPTIONS);
  fillSelect('race', RACE_OPTIONS);
  fillSelect('hispanic', HISPANIC_OPTIONS);
  fillSelect('career', CAREER_OPTIONS);
  renderConsentList('consent-list');

  try {
    const r = localStorage.getItem('reg'); if (r) reg = JSON.parse(r);
    const m = localStorage.getItem('match'); if (m) { match = JSON.parse(m); selectedTopics = new Set(match.topics || []); }
  } catch (e) {}

  if (reg) {
    document.getElementById('badge').value = reg.badge || '';
    document.getElementById('gender').value = reg.gender || '';
    document.getElementById('race').value = reg.race || '';
    document.getElementById('hispanic').value = reg.hispanic || '';
    document.getElementById('career').value = reg.career || '';
    showMain('program');
  } else {
    go('welcome');
  }
})();

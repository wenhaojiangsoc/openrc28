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
let returned = null;        // { badge, return_time } once the badge is handed back
let endConfirm = false;     // End tab: is the confirm-badge sheet open?
let programView = 'schedule'; // 'schedule' | 'session'
let currentSession = null;
let searchQuery = '';
let moreView = 'list'; // 'list' | 'consent' | 'about' | 'contact'
let openDays = new Set([SCHEDULE[0].day]); // collapsible schedule; first day open by default
let openGroups = new Set([RESEARCH_TOPIC_GROUPS[0].category]); // Match topic accordion state

function toggleDay(day) {
  if (openDays.has(day)) openDays.delete(day); else openDays.add(day);
  render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Safe localStorage: some browsers (Safari Private Mode, locked-down settings)
// throw on access. Wrapping it keeps startup behavior identical everywhere —
// a failure just looks like "no saved data" rather than crashing the script.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  remove(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// A registration is only "complete" enough to skip onboarding if every field is
// present. Partial/corrupt data sends the user back to the welcome page.
function regComplete(r) {
  return !!(r && String(r.badge || '').trim() && r.gender && r.race && r.hispanic && r.career);
}

// Local calendar date (YYYY-MM-DD), used to show the Program nudge once per day.
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nudgeDismissedToday() { return store.get('nudge_dismissed') === todayKey(); }
function dismissNudge() { store.set('nudge_dismissed', todayKey()); render(); }

// The iOS Safari "Share" icon (square with an up arrow), so users know what to look for.
const SHARE_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

function openInstallGuide() { document.getElementById('install-guide').classList.remove('hidden'); }
function closeInstallGuide() { document.getElementById('install-guide').classList.add('hidden'); }

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
  programView = 'schedule'; moreView = 'list'; searchQuery = ''; endConfirm = false; // reset sub-views on tab tap
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
// Returns true on success (or in demo mode). Returns false if the cloud write
// failed, so callers can warn instead of silently losing data.
async function sb(table, row) {
  if (!cloudOn()) return true;
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify([row]),
    });
    return res.ok;
  } catch (e) { return false; }
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
  store.set('reg', JSON.stringify(reg));
  const ok = await sb('participants', { badge_id: badge, gender, race, hispanic, career_stage: career });
  if (cloudOn() && !ok) alert('Saved on this device, but we could not reach the server. Please check your connection; it will not re-send automatically.');
  showMain('program');
}

// ---------- tab renderers ----------
function render() {
  if (currentTab === 'program') return renderProgram();
  if (currentTab === 'end') return renderEnd();
  if (currentTab === 'match') return renderMatch();
  if (currentTab === 'more') return renderMore();
}

function renderProgram() {
  if (programView === 'session' && currentSession) return renderSessionDetail(currentSession);

  const days = SCHEDULE.map((d) => {
    const open = openDays.has(d.day);
    const body = !open ? '' : `<div class="card sched">${
      d.items.map((it) => {
        if ((it.kind || '') === 'session') {
          const n = (it.title.match(/(\d)/) || [])[1];
          const subs = SESSIONS.filter((s) => s.id.startsWith(n));
          return `<div class="sitem k-session"><div class="stime">${it.time}</div><div class="sbody" style="flex:1">${
            subs.map((s) => `<div class="srow" onclick="openSession('${s.id}')"><div class="sid">${s.id}</div><div style="flex:1;min-width:0"><div class="stitle">${escapeHtml(s.title)}</div><div class="sloc">${s.room}</div></div><span class="chev">›</span></div>`).join('')
          }</div></div>`;
        }
        return `<div class="sitem k-${it.kind || 'session'}"><div class="stime">${it.time}</div><div class="sbody"><div class="stitle">${it.title}</div>${it.loc ? `<div class="sloc">${it.loc}</div>` : ''}</div></div>`;
      }).join('')
    }</div>`;
    return `<div class="day-head" onclick="toggleDay('${d.day.replace(/'/g, "\\'")}')"><span>${d.day}</span><span class="chev">${open ? '▲' : '▼'}</span></div>${body}`;
  }).join('');

  const nudge = nudgeDismissedToday() ? '' : `
    <div class="nudge">
      <button class="nudge-x" onclick="dismissNudge()" aria-label="Dismiss">×</button>
      <div class="nudge-title">Conferences are about people</div>
      <div class="nudge-text">The best part of RC28 is who you meet. Open Match to discover scholars who share your interests, and reach out to say hello.</div>
      <button class="btn" style="background:#fff;color:var(--brown);margin-top:12px" onclick="setTab('match')">Open Match →</button>
    </div>`;
  setContent(`
    <h1>Welcome to RC28</h1>
    <p class="sub">NYU · Aug 4–7, 2026</p>
    ${nudge}
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
    <button class="back" style="text-align:left;margin:0 0 10px" onclick="backToSchedule()">← Schedule</button>
    <div class="sd-id">SESSION ${s.id}</div>
    <h1 style="font-size:22px;margin-top:4px">${escapeHtml(s.title)}</h1>
    <div class="meta-pills">
      <span class="pill">${s.room}</span>
      <span class="pill">${s.day}</span>
      <span class="pill">${s.time}</span>
    </div>
    ${s.papers.map((p) => `
      <div class="paper">
        <div class="ptitle">${escapeHtml(p.title)}</div>
        <div class="pauth">${escapeHtml(p.authors)}</div>
      </div>`).join('')}
  `);
}

// ---------- End tab (return your badge) ----------
function renderEnd() {
  if (returned) return renderReturned();
  const badge = (reg && reg.badge) || '';
  setContent(`
    <div class="center" style="min-height:70vh">
      <div style="font-size:54px">🎁</div>
      <h1>Returning your badge</h1>
      <p class="sub">When you're finished with the conference, hand your badge back at the registration counter and pick up your gift.</p>
      <p class="sub" style="margin-bottom:4px">Your badge number</p>
      <div style="font-size:42px;font-weight:800;color:var(--brown);margin-bottom:6px">#${escapeHtml(badge)}</div>
      <button class="btn" onclick="openEndConfirm()">I'm returning my badge</button>
    </div>
    ${endConfirm ? endConfirmSheet(badge) : ''}
  `);
}

function endConfirmSheet(badge) {
  return `
    <div class="modal" onclick="if(event.target===this)closeEndConfirm()">
      <div class="sheet">
        <button class="x2" onclick="closeEndConfirm()">×</button>
        <h3 class="ghead">Confirm badge number</h3>
        <p class="gsub">Make sure this matches the number printed on your badge — correct it here if needed.</p>
        <label class="field"><span class="l">Badge ID</span>
          <input id="end-badge" inputmode="numeric" value="${escapeHtml(badge)}" style="text-align:center" /></label>
        <p class="gsub">Confirming marks the end of your participation. You can undo this right after if it was a mistake.</p>
        <button class="btn" onclick="confirmReturn()">Confirm return</button>
        <button class="back" onclick="closeEndConfirm()">Cancel</button>
      </div>
    </div>`;
}

function openEndConfirm() { endConfirm = true; render(); }
function closeEndConfirm() { endConfirm = false; render(); }

async function confirmReturn() {
  const badge = (document.getElementById('end-badge').value || '').trim();
  if (!badge) { alert('Please enter your badge number.'); return; }
  const return_time = new Date().toISOString();
  returned = { badge, return_time };
  store.set('returned', JSON.stringify(returned));
  endConfirm = false;
  render();
  const ok = await sb('badge_events', { badge_id: String(badge), event: 'returned', ts: return_time });
  if (cloudOn() && !ok) alert('Saved on this device, but we could not reach the server. Please let the registration desk know.');
}

function renderReturned() {
  const t = new Date(returned.return_time);
  const when = isNaN(t.getTime()) ? '' : ` at ${t.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
  setContent(`
    <div class="center" style="min-height:70vh">
      <div style="font-size:54px">✅</div>
      <h1>Badge #${escapeHtml(returned.badge)} returned</h1>
      <p class="sub">Marked returned${when}. Thank you for taking part — please hand your badge to the registration counter and collect your gift.</p>
      <button class="back" onclick="undoReturn()">Undo — I haven't returned it yet</button>
    </div>
  `);
}

async function undoReturn() {
  const badge = returned && returned.badge;
  returned = null;
  store.remove('returned');
  render();
  if (badge) sb('badge_events', { badge_id: String(badge), event: 'return_undone', ts: new Date().toISOString() });
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
    const open = openGroups.has(g.category);
    const items = g.topics.map((t) => {
      const sel = selectedTopics.has(t) ? 'sel' : '';
      return `<div class="topic ${sel}" onclick="toggleTopic('${t.replace(/'/g, "\\'")}')"><span>${t}</span><span class="mark">${selectedTopics.has(t) ? '●' : '○'}</span></div>`;
    }).join('');
    const n = g.topics.filter((t) => selectedTopics.has(t)).length;
    return `<div><div class="acc-head" onclick="toggleGroup(${gi})"><span>${g.category}</span><span>${n ? `<span class="chip-pill">${n}</span> ` : ''}<span class="chev" data-g="${gi}">${open ? '▲' : '▼'}</span></span></div><div class="acc-body" data-body="${gi}" style="${open ? '' : 'display:none'}">${items}</div></div>`;
  }).join('');
}
function toggleGroup(gi) {
  const cat = RESEARCH_TOPIC_GROUPS[gi].category;
  if (openGroups.has(cat)) openGroups.delete(cat); else openGroups.add(cat);
  renderTopics();
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
  store.set('match', JSON.stringify(match));
  const ok = await sb('match_profiles', { badge_id: reg.badge, name, affiliation: affil, interests: topics, arm });
  if (cloudOn() && !ok) alert('Saved on this device, but we could not reach the server. Please check your connection.');
  renderMatch();
}

function renderMatches() {
  const list = rankMatches(match.topics);
  const cards = list.length === 0
    ? `<div class="card"><div class="rtext">No matches yet. Add more interests in your profile to find people.</div></div>`
    : list.map((m) => `
      <div class="match">
        <div class="head"><div class="avatar">${escapeHtml(m.name.charAt(0))}</div><div><div class="name">${escapeHtml(m.name)}</div><div class="affil">${escapeHtml(m.affiliation)}</div></div></div>
        <div class="tags">${m.sharedTopics.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        <button class="btn outline" style="margin-top:0" onclick="toggleEmail('${m.id}')">Email</button>
        <div class="email ${revealed.has(m.id) ? '' : 'hidden'}">${escapeHtml(m.email)}</div>
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
  store.remove('reg');
  store.remove('match');
  store.remove('returned');
  reg = null; match = null; returned = null; endConfirm = false; selectedTopics = new Set(); consentOk = false; matchPhase = 'intro'; revealed = new Set();
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
  if (isStandalone() || store.get('a2hs_dismissed')) return;
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
    text.innerHTML = `<span class="shareico">${SHARE_SVG}</span> Add OpenRC28 to your Home Screen for one-tap access.`;
    act.textContent = 'How?';
    act.classList.remove('hidden');
    act.onclick = openInstallGuide;
    banner.classList.remove('hidden');
  }
}
function dismissA2HS() {
  document.getElementById('a2hs').classList.add('hidden');
  store.set('a2hs_dismissed', '1');
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

  let savedReg = null, savedMatch = null;
  try { const r = store.get('reg'); if (r) savedReg = JSON.parse(r); } catch (e) {}
  try { const m = store.get('match'); if (m) savedMatch = JSON.parse(m); } catch (e) {}
  try { const t = store.get('returned'); if (t) returned = JSON.parse(t); } catch (e) {}

  // Pre-fill the register form with whatever we have, so a returning or
  // partially-registered user doesn't retype — but only complete registrations
  // skip onboarding. Everyone else always starts on the welcome page.
  if (savedReg) {
    document.getElementById('badge').value = savedReg.badge || '';
    document.getElementById('gender').value = savedReg.gender || '';
    document.getElementById('race').value = savedReg.race || '';
    document.getElementById('hispanic').value = savedReg.hispanic || '';
    document.getElementById('career').value = savedReg.career || '';
  }

  if (regComplete(savedReg)) {
    reg = savedReg;
    if (savedMatch) { match = savedMatch; selectedTopics = new Set(match.topics || []); }
    showMain('program');
  } else {
    reg = null; match = null; returned = null;
    go('welcome');
  }
})();

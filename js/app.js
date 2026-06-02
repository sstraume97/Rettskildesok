// =============================================================
// RETTSKILDESØK PRO v3.0 – APPLIKASJONSLOGIKK
// =============================================================

const STORAGE_KEYS = {
  theme: 'rsp_theme',
  history: 'rsp_history',
  savedSearches: 'rsp_saved',
  customSites: 'rsp_custom_sites',
  workbooks: 'rsp_workbooks',
  activeWb: 'rsp_active_wb',
  sidebarOpen: 'rsp_sidebar',
};

const MAX_STORAGE_WARN_MB = 3.5;

// ---- STATE ----
const state = {
  theme: localStorage.getItem(STORAGE_KEYS.theme) || 'light',
  history: [],
  savedSearches: [],
  customSites: [],
  workbooks: [],
  activeWbId: localStorage.getItem(STORAGE_KEYS.activeWb) || 'default',
  wbHistory: {}, // id -> stack of content strings for undo
};

let autosaveTimer = null;
let queryLiveTimer = null;

function loadState() {
  try { state.history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]'); } catch { state.history = []; }
  try { state.savedSearches = JSON.parse(localStorage.getItem(STORAGE_KEYS.savedSearches) || '[]'); } catch { state.savedSearches = []; }
  try { state.customSites = JSON.parse(localStorage.getItem(STORAGE_KEYS.customSites) || '[]'); } catch { state.customSites = []; }
  try {
    const wbs = JSON.parse(localStorage.getItem(STORAGE_KEYS.workbooks));
    state.workbooks = wbs && wbs.length ? wbs : [{
      id: 'default', title: 'Generell Kladdblokk',
      content: '<h3>📄 Din personlige arbeidsbenk</h3><p>Skriv, lim inn og organiser dine juridiske funn her. Bruk <strong>🔗 Autolenk</strong>-knappen for å konvertere referanser som <code>HR-2022-123-A</code> eller <code>Lov-2005-06-17-62</code> til klikkbare Lovdata-lenker.</p>',
      created: new Date().toLocaleDateString('no-NO'), versions: [],
    }];
  } catch { state.workbooks = []; }
}

// ---- INIT ----
function initApp() {
  loadState();
  applyTheme(state.theme);
  renderAllSources();
  renderCustomSites();
  renderWorkbookSelector();
  loadActiveWorkbook();
  updateLibraryUI();
  initURLParams();
  setupKeyboardShortcuts();
  setupRawTextParser();
  setupLiveQueryPreview();
  setupAutocomplete();
  checkStorageUsage();

  const sidebarWasOpen = localStorage.getItem(STORAGE_KEYS.sidebarOpen) !== 'false';
  setSidebarOpen(window.innerWidth >= 1024 && sidebarWasOpen, false);

  // Mobile: close sidebar when resizing up
  window.addEventListener('resize', () => {
    if (window.innerWidth < 1024) setSidebarOpen(false, false);
  });

  console.log(`RettskildeSøk PRO v${APP_VERSION} klar.`);
}

// ---- THEME ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️ Lyst' : '🌙 Mørkt';
}
function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); }

// ---- SIDEBAR ----
function setSidebarOpen(open, save = true) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const main = document.getElementById('mainContent');
  if (!sidebar) return;
  if (open) {
    sidebar.classList.add('open'); sidebar.classList.remove('closed');
    if (window.innerWidth < 1024 && overlay) overlay.classList.add('visible');
    if (window.innerWidth >= 1024) main.classList.add('sidebar-open');
  } else {
    sidebar.classList.remove('open'); sidebar.classList.add('closed');
    if (overlay) overlay.classList.remove('visible');
    main.classList.remove('sidebar-open');
  }
  if (save) localStorage.setItem(STORAGE_KEYS.sidebarOpen, open);
}
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  setSidebarOpen(s.classList.contains('closed'));
}

// ---- RENDER SOURCES ----
function renderAllSources() {
  const container = document.getElementById('sourcesContainer');
  if (!container) return;
  container.innerHTML = SOURCE_CATEGORIES.map(cat => {
    const total = cat.sources.length;
    return `
    <div class="source-category" id="cat_${cat.id}">
      <div class="category-header" onclick="toggleCategory('${cat.id}')">
        <span class="category-dot ${cat.colorClass}"></span>
        <span class="category-title">${cat.title}</span>
        <span class="cat-count" id="count_${cat.id}">0/${total}</span>
        <button class="cat-toggle-btn" id="toggle_${cat.id}" aria-label="Fold/utfold">▾</button>
      </div>
      <div class="source-list" id="list_${cat.id}">
        ${cat.sources.map(src => `
          <div class="source-item ${cat.colorClass}" data-keywords="${(src.keywords||[]).join(' ')}" id="item_${src.id}">
            <input type="checkbox" id="${src.id}" value="${src.value}"
              ${src.defaultChecked ? 'checked' : ''}
              onchange="onSourceChange()">
            <label for="${src.id}">
              <span class="source-label">${src.label}${src.directPortal ? ' <span class="portal-badge" title="Direkte portalsøk tilgjengelig">⚡</span>' : ''}</span>
              <span class="source-desc">${src.desc}</span>
              ${src.warning ? `<span class="source-warning">⚠️ ${src.warning}</span>` : ''}
            </label>
          </div>
        `).join('')}
      </div>
    </div>`;
  }).join('');
  updateAllCategoryCounts();
}

function toggleCategory(catId) {
  const list = document.getElementById(`list_${catId}`);
  const btn = document.getElementById(`toggle_${catId}`);
  if (!list) return;
  const hidden = list.style.display === 'none';
  list.style.display = hidden ? '' : 'none';
  if (btn) btn.textContent = hidden ? '▾' : '▸';
}

function onSourceChange() {
  updateAllCategoryCounts();
  updateURLParams();
  updateLiveQueryPreview();
}

function updateAllCategoryCounts() {
  SOURCE_CATEGORIES.forEach(cat => {
    const checked = cat.sources.filter(s => {
      const cb = document.getElementById(s.id);
      return cb && cb.checked;
    }).length;
    const el = document.getElementById(`count_${cat.id}`);
    if (el) {
      el.textContent = `${checked}/${cat.sources.length}`;
      el.classList.toggle('has-checked', checked > 0);
    }
  });
}

// ---- SOURCE FILTER ----
function filterSources(query) {
  const q = (query || '').toLowerCase().trim();
  document.querySelectorAll('.source-item').forEach(item => {
    if (!q) { item.style.display = ''; return; }
    const label = (item.querySelector('.source-label')?.textContent || '').toLowerCase();
    const desc = (item.querySelector('.source-desc')?.textContent || '').toLowerCase();
    const kw = (item.getAttribute('data-keywords') || '').toLowerCase();
    item.style.display = (label.includes(q) || desc.includes(q) || kw.includes(q)) ? '' : 'none';
  });
}

function toggleAllSources(checked) {
  document.querySelectorAll('.source-item:not([style*="display: none"]) input[type="checkbox"]')
    .forEach(cb => { cb.checked = checked; });
  onSourceChange();
}

// ---- CUSTOM SITES ----
function addCustomSite() {
  const input = document.getElementById('customSiteInput');
  let url = (input.value || '').trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!url) return;
  if (state.customSites.some(s => s.url === url)) { showToast('Siden er allerede lagt til.', 'warning'); return; }
  state.customSites.push({ id: Date.now(), url, checked: true });
  saveCustomSites();
  input.value = '';
  renderCustomSites();
  updateURLParams();
}

function removeCustomSite(id) {
  state.customSites = state.customSites.filter(s => s.id !== id);
  saveCustomSites();
  renderCustomSites();
  updateURLParams();
}

function toggleCustomSite(id, checked) {
  const s = state.customSites.find(x => x.id === id);
  if (s) s.checked = checked;
  saveCustomSites();
  updateURLParams();
}

function saveCustomSites() {
  localStorage.setItem(STORAGE_KEYS.customSites, JSON.stringify(state.customSites));
}

function renderCustomSites() {
  const c = document.getElementById('customSitesContainer');
  if (!c) return;
  if (!state.customSites.length) {
    c.innerHTML = '<span class="empty-note">Ingen egne sider lagt til ennå.</span>'; return;
  }
  c.innerHTML = state.customSites.map(s => `
    <div class="custom-site-tag">
      <input type="checkbox" id="cs_${s.id}" ${s.checked ? 'checked' : ''} onchange="toggleCustomSite(${s.id}, this.checked)">
      <label for="cs_${s.id}">${s.url}</label>
      <button class="remove-site-btn" onclick="removeCustomSite(${s.id})" title="Fjern">×</button>
    </div>`).join('');
}

// ---- QUERY BUILDER ----
function getCheckedSources() {
  return Array.from(document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked'))
    .map(cb => ({
      id: cb.id,
      value: cb.value,
      sourceObj: SOURCE_CATEGORIES.flatMap(c => c.sources).find(s => s.id === cb.id),
    }));
}

function buildGoogleQuery(rawQuery, options = {}) {
  const { exactPhrase, excludeWords, fileType, yearFrom, yearTo, engine } = options;
  const parts = [];

  // Synonym expansion
  let expanded = rawQuery;
  if (rawQuery && JURIDISK_TESAURUS[rawQuery.toLowerCase()]) {
    const syns = JURIDISK_TESAURUS[rawQuery.toLowerCase()];
    expanded = `(${rawQuery} OR ${syns.slice(0,3).join(' OR ')})`;
  }
  if (expanded) parts.push(expanded);
  if (exactPhrase) parts.push(`"${exactPhrase}"`);
  if (excludeWords) excludeWords.split(/\s+/).filter(Boolean).forEach(w => parts.push(`-${w}`));
  if (fileType && engine !== 'base') parts.push(`filetype:${fileType}`);

  const eng = SEARCH_ENGINES.find(e => e.id === engine);
  if (eng?.supportsDateFilter && eng.dateFormat === 'google') {
    if (yearFrom) parts.push(`after:${yearFrom}-01-01`);
    if (yearTo) parts.push(`before:${yearTo}-12-31`);
  }

  const checkedSources = getCheckedSources();
  const allSiteVals = [];
  checkedSources.forEach(s => s.value.split('|').forEach(v => allSiteVals.push(v.trim())));
  state.customSites.filter(s => s.checked).forEach(s => allSiteVals.push(s.url));

  if (allSiteVals.length > 0) {
    const prefix = engine === 'base' ? 'url:' : 'site:';
    const sitePart = allSiteVals.map(s => `${prefix}${s}`).join(' OR ');
    parts.push(allSiteVals.length > 1 ? `(${sitePart})` : sitePart);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function getFormValues() {
  return {
    rawQuery: (document.getElementById('queryInput')?.value || '').trim(),
    engineId: document.getElementById('engineSelect')?.value || 'google',
    exactPhrase: (document.getElementById('exactMatch')?.value || '').trim(),
    excludeWords: (document.getElementById('excludeWords')?.value || '').trim(),
    fileType: document.getElementById('fileType')?.value || '',
    yearFrom: document.getElementById('yearFrom')?.value || '',
    yearTo: document.getElementById('yearTo')?.value || '',
  };
}

// ---- LIVE QUERY PREVIEW ----
function setupLiveQueryPreview() {
  ['queryInput','exactMatch','excludeWords','fileType','yearFrom','yearTo','engineSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { clearTimeout(queryLiveTimer); queryLiveTimer = setTimeout(updateLiveQueryPreview, 150); });
    if (el && el.tagName === 'SELECT') el.addEventListener('change', updateLiveQueryPreview);
  });
}

function updateLiveQueryPreview() {
  const preview = document.getElementById('liveQueryPreview');
  const previewCode = document.getElementById('liveQueryCode');
  if (!preview || !previewCode) return;
  const { rawQuery, engineId, exactPhrase, excludeWords, fileType, yearFrom, yearTo } = getFormValues();
  const eng = SEARCH_ENGINES.find(e => e.id === engineId);
  if (eng?.isMultiTab) {
    previewCode.textContent = 'Multisøk: åpner én fane per valgt kilde';
    preview.style.display = 'block'; return;
  }
  const q = buildGoogleQuery(rawQuery, { exactPhrase, excludeWords, fileType, yearFrom, yearTo, engine: engineId });
  if (q) { previewCode.textContent = q; preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
}

// ---- EXECUTE SEARCH ----
function executeSearch(e) {
  if (e) e.preventDefault();
  const { rawQuery, engineId, exactPhrase, excludeWords, fileType, yearFrom, yearTo } = getFormValues();
  const eng = SEARCH_ENGINES.find(e => e.id === engineId) || SEARCH_ENGINES[0];

  const checkedSources = getCheckedSources();
  const customChecked = state.customSites.filter(s => s.checked);
  const totalChecked = checkedSources.length + customChecked.length;

  if (!rawQuery && !exactPhrase) { showToast('⚠️ Skriv inn et søkeord.', 'warning'); return; }

  // MULTISØK
  if (eng.isMultiTab) {
    executeMultiTabSearch(rawQuery, { exactPhrase, excludeWords });
    return;
  }

  if (!eng.isMultiTab && totalChecked === 0) { showToast('⚠️ Velg minst én kilde i sidepanelet.', 'warning'); return; }

  const queryString = buildGoogleQuery(rawQuery, { exactPhrase, excludeWords, fileType, yearFrom, yearTo, engine: engineId });

  let url;
  if (eng.id === 'scholar') {
    url = eng.baseUrl + encodeURIComponent(queryString);
    if (yearFrom) url += `&as_ylo=${yearFrom}`;
    if (yearTo) url += `&as_yhi=${yearTo}`;
  } else {
    url = eng.baseUrl + encodeURIComponent(queryString);
  }

  addToHistory(engineId, rawQuery, queryString, checkedSources.map(s => s.id));
  createAutoWorkbook(rawQuery, queryString, engineId);
  updateURLParams();

  window.open(url, '_blank');
  showCompiledString(queryString);
}

// ---- MULTISØK ----
function executeMultiTabSearch(rawQuery, opts = {}) {
  const checkedSources = getCheckedSources();
  const customChecked = state.customSites.filter(s => s.checked);

  if (checkedSources.length === 0 && customChecked.length === 0) {
    showToast('⚠️ Velg minst én kilde for multisøk.', 'warning'); return;
  }

  let q = rawQuery;
  if (opts.exactPhrase) q += ` "${opts.exactPhrase}"`;
  if (opts.excludeWords) opts.excludeWords.split(/\s+/).forEach(w => { q += ` -${w}`; });

  // Sjekk om nettleser blokkerer popup
  let opened = 0;
  const MAX_TABS = 10;

  const openTab = (url) => {
    if (opened >= MAX_TABS) return;
    const w = window.open(url, '_blank');
    if (w) opened++;
  };

  checkedSources.forEach(({ value, sourceObj }) => {
    // Prøv direkte portal-URL først
    const portalUrl = sourceObj?.directPortal ? getPortalUrl(value, q) : null;
    if (portalUrl) {
      openTab(portalUrl);
    } else {
      // Fallback: Google site:
      const siteQuery = `${q} site:${value.split('|')[0]}`;
      openTab('https://www.google.com/search?q=' + encodeURIComponent(siteQuery));
    }
  });

  customChecked.forEach(s => {
    openTab('https://www.google.com/search?q=' + encodeURIComponent(`${q} site:${s.url}`));
  });

  addToHistory('multitab', rawQuery, `Multisøk: ${opened} faner`, checkedSources.map(s => s.id));
  createAutoWorkbook(rawQuery, `Multisøk: ${opened} faner åpnet`, 'multitab');

  if (opened === 0) {
    showToast('⚠️ Nettleseren blokkerte popup-vinduer. Tillat popups for denne siden.', 'warning');
  } else if (opened < checkedSources.length + customChecked.length) {
    showToast(`ℹ️ Åpnet ${opened} faner (maks ${MAX_TABS}). Resten ble ikke åpnet.`, 'warning');
  } else {
    showToast(`✓ Åpnet ${opened} søkefaner`);
  }
}

function getPortalUrl(siteValue, query) {
  const q = encodeURIComponent(query);
  // Direkte match
  if (PORTAL_SEARCH_URLS[siteValue]) {
    return PORTAL_SEARCH_URLS[siteValue].replace('{q}', q);
  }
  // Delvis match (for pipe-verdier)
  const key = Object.keys(PORTAL_SEARCH_URLS).find(k => siteValue.startsWith(k) || siteValue.includes(k));
  if (key) return PORTAL_SEARCH_URLS[key].replace('{q}', q);
  return null;
}

// ---- COMPILED STRING DISPLAY ----
function showCompiledString(str) {
  const el = document.getElementById('compiledStringDisplay');
  const code = document.getElementById('compiledStringCode');
  if (el && code) {
    code.textContent = str;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 8000);
  }
}

function copyQueryString() {
  const { rawQuery, engineId, exactPhrase, excludeWords, fileType, yearFrom, yearTo } = getFormValues();
  const q = buildGoogleQuery(rawQuery, { exactPhrase, excludeWords, fileType, yearFrom, yearTo, engine: engineId });
  if (!q) { showToast('Ingen søkestreng å kopiere.', 'warning'); return; }
  navigator.clipboard.writeText(q).then(() => showToast('✓ Søkestreng kopiert!'));
}

// ---- DATE HELPERS ----
function setRelativeTime(yearsBack) {
  const y = new Date().getFullYear();
  document.getElementById('yearFrom').value = y - yearsBack;
  document.getElementById('yearTo').value = y;
  document.getElementById('advancedSection').open = true;
  updateURLParams(); updateLiveQueryPreview();
}

// ---- OPERATOR HELPERS ----
function insertOperator(type) {
  const input = document.getElementById('queryInput');
  const start = input.selectionStart, end = input.selectionEnd;
  const val = input.value, sel = val.substring(start, end);
  const reps = {
    phrase: `"${sel || 'frase'}"`,
    and: ` ${sel || 'ord1'} AND ord2 `,
    or: ` ${sel || 'ord1'} OR ord2 `,
    not: ` -${sel || 'utelatOrd'}`,
    siteNot: ` -site:${sel || 'domene.no'}`,
    wildcard: `${sel || 'arbeids'}*`,
    near: ` "${sel || 'ord1'} ord2"~5`,
  };
  const r = reps[type] || '';
  input.value = val.substring(0, start) + r + val.substring(end);
  input.focus();
  input.setSelectionRange(start + r.length, start + r.length);
  updateURLParams(); updateLiveQueryPreview();
}

// ---- AUTOCOMPLETE ----
function setupAutocomplete() {
  const input = document.getElementById('queryInput');
  const listEl = document.getElementById('autocompleteList');
  if (!input || !listEl) return;

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    if (val.length < 2) { listEl.style.display = 'none'; return; }
    const matches = LOVNAVN_AUTOCOMPLETE.filter(l =>
      l.navn.toLowerCase().includes(val) || l.lov.toLowerCase().includes(val)
    ).slice(0, 7);
    if (!matches.length) { listEl.style.display = 'none'; return; }
    listEl.innerHTML = matches.map((m, i) => `
      <div class="ac-item" tabindex="0" data-index="${i}"
        onmousedown="selectAutocomplete('${m.navn.replace(/'/g, "\\'")}', '${m.lov}')"
        onkeydown="if(event.key==='Enter') selectAutocomplete('${m.navn.replace(/'/g, "\\'")}', '${m.lov}')">
        <span class="ac-navn">${m.navn}</span>
        <span class="ac-lov">${m.lov}</span>
      </div>`).join('');
    listEl.style.display = 'block';
  });

  input.addEventListener('blur', () => setTimeout(() => { listEl.style.display = 'none'; }, 150));

  document.addEventListener('keydown', (e) => {
    if (listEl.style.display === 'none') return;
    const items = listEl.querySelectorAll('.ac-item');
    const focused = listEl.querySelector('.ac-item:focus');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!focused) items[0]?.focus();
      else { const i = [...items].indexOf(focused); items[i+1]?.focus(); }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (focused) { const i = [...items].indexOf(focused); if (i > 0) items[i-1]?.focus(); else input.focus(); }
    }
    if (e.key === 'Escape') { listEl.style.display = 'none'; input.focus(); }
  });
}

function selectAutocomplete(navn, lov) {
  const input = document.getElementById('queryInput');
  if (input) input.value = lov;
  const listEl = document.getElementById('autocompleteList');
  if (listEl) listEl.style.display = 'none';
  updateURLParams(); updateLiveQueryPreview();
}

// ---- BUNDLES ----
function applyBundle(bundleId) {
  const bundle = BUNDLES.find(b => b.id === bundleId);
  if (!bundle) return;
  document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  if (bundle.sourceIds === null) {
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = true; });
  } else {
    bundle.sourceIds.forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = true; });
  }
  onSourceChange();
  showToast(`✓ "${bundle.label}" lastet (${bundle.sourceIds ? bundle.sourceIds.length : 'alle'} kilder)`);
}

// ---- RAW TEXT PARSER ----
function setupRawTextParser() {
  const ta = document.getElementById('rawTextParser');
  if (!ta) return;
  ta.addEventListener('input', () => {
    const text = ta.value.toLowerCase();
    if (!text.trim()) return;
    let hits = 0;
    SOURCE_CATEGORIES.forEach(cat => cat.sources.forEach(src => {
      const match = (src.keywords||[]).some(kw => text.includes(kw.toLowerCase()));
      const cb = document.getElementById(src.id);
      if (cb && match && !cb.checked) { cb.checked = true; hits++; }
    }));
    if (hits > 0) { onSourceChange(); showToast(`✓ ${hits} relevante kilder aktivert automatisk`); }

    // Nøkkelordforslag
    extractKeywordSuggestions(ta.value);
  });
}

function extractKeywordSuggestions(text) {
  const container = document.getElementById('keywordSuggestions');
  if (!container) return;

  // Enkel ekstraksjon: finn ord > 5 tegn som ligner juridiske termer
  const juridiskeMønstre = [
    /\b(lov|forskrift|paragraf|§\s*\d+|nr\.\s*\d+)\b/gi,
    /\b(aml|fvl|tvl|strl|avl|pbl|mfl|ftrl)\b/gi,
    /\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, // dato-mønstre
    /\b[A-ZÆØÅ]{2,}\b/g, // akronymer
  ];

  const found = new Set();
  juridiskeMønstre.forEach(re => {
    const matches = text.match(re) || [];
    matches.forEach(m => { if (m.length > 2) found.add(m.trim()); });
  });

  if (!found.size) { container.style.display = 'none'; return; }

  const terms = [...found].slice(0, 8);
  container.innerHTML = `
    <span class="kw-label">💡 Foreslåtte søkeord:</span>
    ${terms.map(t => `<button class="kw-chip" onclick="insertKeyword('${t.replace(/'/g,"\\'")}')"><span>${t}</span></button>`).join('')}
  `;
  container.style.display = 'flex';
}

function insertKeyword(word) {
  const input = document.getElementById('queryInput');
  if (!input) return;
  const current = input.value.trim();
  input.value = current ? `${current} ${word}` : word;
  input.focus();
  updateURLParams(); updateLiveQueryPreview();
  showToast(`✓ "${word}" lagt til i søkefeltet`);
}

// ---- HISTORY ----
function addToHistory(engineId, rawQuery, queryString, sourceIds = []) {
  if (!rawQuery && !queryString) return;
  state.history.unshift({
    id: Date.now(), engine: engineId, query: rawQuery,
    fullString: queryString, sourceIds,
    time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString('no-NO'),
  });
  if (state.history.length > 50) state.history = state.history.slice(0, 50);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
  updateLibraryUI();
}

// ---- SAVED SEARCHES ----
function saveCurrentSearch() {
  const { rawQuery, engineId, exactPhrase, excludeWords, fileType, yearFrom, yearTo } = getFormValues();
  const name = prompt('Gi søket et navn:', rawQuery || 'Mitt juridiske søk');
  if (!name) return;
  state.savedSearches.unshift({
    id: Date.now(), name, engine: engineId, query: rawQuery,
    queryString: buildGoogleQuery(rawQuery, { exactPhrase, excludeWords, fileType, yearFrom, yearTo, engine: engineId }),
    sourceIds: getCheckedSources().map(s => s.id),
    exactPhrase, excludeWords, fileType, yearFrom, yearTo,
    date: new Date().toLocaleDateString('no-NO'),
  });
  localStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(state.savedSearches));
  updateLibraryUI();
  showToast('✓ Søket er lagret i biblioteket');
}

function loadSavedSearch(id) {
  const s = state.savedSearches.find(x => x.id === id);
  if (!s) return;
  const ef = document.getElementById('engineSelect'); if (ef) ef.value = s.engine;
  const qi = document.getElementById('queryInput'); if (qi) qi.value = s.query || '';
  if (document.getElementById('exactMatch')) document.getElementById('exactMatch').value = s.exactPhrase || '';
  if (document.getElementById('excludeWords')) document.getElementById('excludeWords').value = s.excludeWords || '';
  if (document.getElementById('fileType')) document.getElementById('fileType').value = s.fileType || '';
  if (document.getElementById('yearFrom')) document.getElementById('yearFrom').value = s.yearFrom || '';
  if (document.getElementById('yearTo')) document.getElementById('yearTo').value = s.yearTo || '';
  document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  (s.sourceIds||[]).forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = true; });
  onSourceChange(); updateLiveQueryPreview();
  switchTab('search-tab');
  showToast(`✓ "${s.name}" lastet inn`);
}

function deleteSavedSearch(id, e) {
  e.stopPropagation();
  if (!confirm('Slette dette søket?')) return;
  state.savedSearches = state.savedSearches.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(state.savedSearches));
  updateLibraryUI();
}

function restoreFromHistory(id) {
  const h = state.history.find(x => x.id === id);
  if (!h) return;
  const ef = document.getElementById('engineSelect'); if (ef) ef.value = h.engine;
  const qi = document.getElementById('queryInput'); if (qi) qi.value = h.query || '';
  if (h.sourceIds?.length) {
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    h.sourceIds.forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = true; });
  }
  onSourceChange(); updateLiveQueryPreview();
  switchTab('search-tab');
  showToast('✓ Historisk søk gjenopprettet');
}

function clearHistory() {
  if (!confirm('Slette all søkehistorikk?')) return;
  state.history = [];
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify([]));
  updateLibraryUI();
}

function updateLibraryUI() {
  const savedList = document.getElementById('savedSearchesList');
  const historyList = document.getElementById('historyList');
  const tabBtn = document.getElementById('libraryTabBtn');
  if (tabBtn) tabBtn.textContent = `📚 Bibliotek (${state.savedSearches.length})`;

  if (savedList) {
    if (!state.savedSearches.length) {
      savedList.innerHTML = '<p class="empty-note">Ingen lagrede søk ennå. Konfigurer et søk og klikk «Lagre søk».</p>';
    } else {
      savedList.innerHTML = state.savedSearches.map(s => `
        <div class="list-item" onclick="loadSavedSearch(${s.id})">
          <div class="list-item-info">
            <div class="list-item-title">${s.name} <span class="engine-badge">${(s.engine||'').toUpperCase()}</span></div>
            <div class="list-item-meta">Lagret ${s.date} · «${s.query||'avansert'}» · ${(s.sourceIds||[]).length} kilder</div>
            <div class="query-string-preview">${s.queryString||''}</div>
          </div>
          <button class="btn-icon danger" onclick="deleteSavedSearch(${s.id}, event)" title="Slett">🗑</button>
        </div>`).join('');
    }
  }

  if (historyList) {
    if (!state.history.length) {
      historyList.innerHTML = '<p class="empty-note">Ingen søkehistorikk ennå.</p>';
    } else {
      historyList.innerHTML = state.history.map(h => `
        <div class="list-item history-item" onclick="restoreFromHistory(${h.id})">
          <div class="list-item-info">
            <div class="list-item-title">🔍 ${h.query||'[Avansert]'} <span class="engine-badge">${(h.engine||'').toUpperCase()}</span></div>
            <div class="list-item-meta">${h.date} kl. ${h.time}</div>
            <div class="query-string-preview">${h.fullString||''}</div>
          </div>
        </div>`).join('');
    }
  }
}

// ---- WORKBOOK ----
function createAutoWorkbook(query, fullString, engineId) {
  const now = new Date();
  const id = 'wb_' + now.getTime();
  const time = now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('no-NO');
  const title = `${query || 'Avansert'} (${time})`;
  const content = `<h3>📂 ${query || 'Avansert søk'}</h3>
<p><small>Opprettet ${date} kl. ${time} · Motor: ${engineId}</small></p>
<p><strong>Søkestreng:</strong></p>
<pre>${fullString}</pre>
<hr>
<p><em>Skriv inn dine funn og notater her...</em></p>`;
  state.workbooks.unshift({ id, title, content, created: date, versions: [] });
  if (state.workbooks.length > 50) state.workbooks = state.workbooks.slice(0, 50);
  state.activeWbId = id;
  saveWorkbooks();
  renderWorkbookSelector();
  loadActiveWorkbook();
}

function saveWorkbooks() {
  localStorage.setItem(STORAGE_KEYS.workbooks, JSON.stringify(state.workbooks));
  localStorage.setItem(STORAGE_KEYS.activeWb, state.activeWbId);
}

function renderWorkbookSelector() {
  const sel = document.getElementById('workbookSelector');
  if (!sel) return;
  sel.innerHTML = state.workbooks.map(wb => `<option value="${wb.id}">${wb.title}</option>`).join('');
  sel.value = state.activeWbId;
}

function loadActiveWorkbook() {
  const wb = state.workbooks.find(w => w.id === state.activeWbId) || state.workbooks[0];
  if (!wb) return;
  state.activeWbId = wb.id;
  const editor = document.getElementById('workbookEditor');
  if (editor) editor.innerHTML = wb.content || '';
  const sel = document.getElementById('workbookSelector');
  if (sel) sel.value = wb.id;
  const vcount = document.getElementById('versionCount');
  if (vcount) vcount.textContent = `${(wb.versions||[]).length} versjoner`;
}

function switchWorkbook(id) {
  saveCurrentWorkbookContent();
  state.activeWbId = id;
  saveWorkbooks();
  loadActiveWorkbook();
}

function saveCurrentWorkbookContent() {
  const wb = state.workbooks.find(w => w.id === state.activeWbId);
  const editor = document.getElementById('workbookEditor');
  if (wb && editor) {
    wb.content = editor.innerHTML;
    saveWorkbooks();
  }
}

function onEditorInput() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveCurrentWorkbookContent();
    showAutosaveIndicator();
  }, 600);
}

function showAutosaveIndicator() {
  const el = document.getElementById('autosaveIndicator');
  if (!el) return;
  el.style.opacity = '1'; el.textContent = '✓ Lagret';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function saveWorkbookVersion() {
  const wb = state.workbooks.find(w => w.id === state.activeWbId);
  const editor = document.getElementById('workbookEditor');
  if (!wb || !editor) return;
  if (!wb.versions) wb.versions = [];
  wb.versions.unshift({
    ts: new Date().toLocaleString('no-NO'),
    content: editor.innerHTML,
  });
  if (wb.versions.length > 10) wb.versions = wb.versions.slice(0, 10);
  wb.content = editor.innerHTML;
  saveWorkbooks();
  const vcount = document.getElementById('versionCount');
  if (vcount) vcount.textContent = `${wb.versions.length} versjoner`;
  showToast('✓ Versjon lagret');
}

function showVersionHistory() {
  const wb = state.workbooks.find(w => w.id === state.activeWbId);
  if (!wb || !wb.versions?.length) { showToast('Ingen lagrede versjoner for denne boken.', 'warning'); return; }
  const list = wb.versions.map((v, i) => `${i+1}. ${v.ts}`).join('\n');
  const choice = prompt(`Velg versjonsnummer for gjenoppretting:\n\n${list}\n\nSkriv nummer (eller avbryt):`);
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= wb.versions.length) return;
  const editor = document.getElementById('workbookEditor');
  if (editor) editor.innerHTML = wb.versions[idx].content;
  onEditorInput();
  showToast(`✓ Versjon ${idx+1} (${wb.versions[idx].ts}) gjenopprettet`);
}

function newWorkbook() {
  const title = prompt('Navn på ny arbeidsbok:', 'Ny arbeidsbok');
  if (!title) return;
  const id = 'wb_' + Date.now();
  state.workbooks.unshift({ id, title, content: `<h3>${title}</h3><p><em>Start å skrive her...</em></p>`, created: new Date().toLocaleDateString('no-NO'), versions: [] });
  state.activeWbId = id;
  saveWorkbooks();
  renderWorkbookSelector();
  loadActiveWorkbook();
}

function deleteCurrentWorkbook() {
  if (state.workbooks.length <= 1) { showToast('Kan ikke slette den eneste arbeidsboken.', 'warning'); return; }
  if (!confirm('Slette denne arbeidsboken permanent?')) return;
  state.workbooks = state.workbooks.filter(w => w.id !== state.activeWbId);
  state.activeWbId = state.workbooks[0].id;
  saveWorkbooks();
  renderWorkbookSelector();
  loadActiveWorkbook();
}

function exportWorkbookText() {
  saveCurrentWorkbookContent();
  const wb = state.workbooks.find(w => w.id === state.activeWbId);
  if (!wb) return;
  const div = document.createElement('div');
  div.innerHTML = wb.content;
  const blob = new Blob([div.innerText], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${wb.title.replace(/[^a-z0-9æøåÆØÅ]/gi, '_')}.txt`;
  a.click();
}

function printWorkbook() {
  saveCurrentWorkbookContent();
  const wb = state.workbooks.find(w => w.id === state.activeWbId);
  if (!wb) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">
    <title>${wb.title}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #000; }
      h1,h2,h3 { color: #000; } pre { background: #f5f5f5; padding: 10px; border: 1px solid #ccc; }
      a { color: #1e40af; } hr { border: none; border-top: 1px solid #ccc; }
      .print-header { border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
      @media print { .no-print { display: none; } }
    </style></head><body>
    <div class="print-header"><h1>${wb.title}</h1><small>RettskildeSøk PRO · ${new Date().toLocaleDateString('no-NO')}</small></div>
    ${wb.content}
    <script>window.onload=()=>window.print();<\/script>
  </body></html>`);
  win.document.close();
}

// ---- EDITOR FORMATTING (modern – ingen execCommand der mulig) ----
function insertFormatting(command) {
  // execCommand er deprecated men fortsatt fungerende i alle nettlesere
  // Erstatning med Selection API for de vanligste kommandoene
  const editor = document.getElementById('workbookEditor');
  if (!editor) return;
  editor.focus();

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  if (command === 'bold') wrapSelection('strong');
  else if (command === 'italic') wrapSelection('em');
  else if (command === 'underline') wrapSelection('u');
  else if (command === 'insertUnorderedList') insertListAtCursor('ul');
  else if (command === 'insertOrderedList') insertListAtCursor('ol');
  else if (command === 'removeFormat') {
    document.execCommand('removeFormat', false, null);
    document.execCommand('formatBlock', false, 'p');
  }
  onEditorInput();
}

function wrapSelection(tag) {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) {
    // Ingen seleksjon – bare sett inn tom tag
    document.execCommand('insertHTML', false, `<${tag}></${tag}>`);
    return;
  }
  const range = selection.getRangeAt(0);
  const wrapper = document.createElement(tag);
  try {
    range.surroundContents(wrapper);
  } catch {
    // Fallback for komplekse seleksjoner
    const frag = range.extractContents();
    wrapper.appendChild(frag);
    range.insertNode(wrapper);
  }
  selection.removeAllRanges();
}

function insertListAtCursor(type) {
  const tag = type === 'ul' ? 'ul' : 'ol';
  const html = `<${tag}><li>Element</li></${tag}>`;
  document.execCommand('insertHTML', false, html);
}

function insertHeading(level) {
  document.execCommand('formatBlock', false, `h${level}`);
  onEditorInput();
}

function runLawAutolink() {
  const editor = document.getElementById('workbookEditor');
  if (!editor) return;
  let html = editor.innerHTML;

  // HR-YYYY-NNN-A (ny Høyesterett)
  html = html.replace(/\b(HR-\d{4}-\d+-[A-ZU])\b/g,
    m => `<a href="https://lovdata.no/sok?q=${encodeURIComponent(m)}" target="_blank" class="law-link hr-link" title="Søk i Lovdata">${m}</a>`);

  // Rt-YYYY-NNN (historisk Høyesterett)
  html = html.replace(/\b(Rt[-–]\d{4}[-–]\d+)\b/g,
    m => `<a href="https://lovdata.no/sok?q=${encodeURIComponent(m.replace('–','-'))}" target="_blank" class="law-link rt-link" title="Søk i Lovdata">${m}</a>`);

  // Lov-YYYY-MM-DD eller Lov-YYYY-MM-DD-NN
  html = html.replace(/\b(Lov-\d{4}-\d{2}-\d{2}(?:-\d+)?)\b/gi,
    m => `<a href="https://lovdata.no/dokument/NL/${m.toLowerCase()}" target="_blank" class="law-link lov-link" title="Åpne i Lovdata">${m}</a>`);

  // FOR-YYYY-MM-DD-NN (forskrift)
  html = html.replace(/\b(FOR-\d{4}-\d{2}-\d{2}-\d+)\b/gi,
    m => `<a href="https://lovdata.no/dokument/SF/${m.toLowerCase()}" target="_blank" class="law-link for-link" title="Åpne i Lovdata">${m}</a>`);

  // NOU YYYY:NN
  html = html.replace(/\b(NOU\s+\d{4}\s*:\s*\d+)\b/g,
    m => `<a href="https://www.regjeringen.no/no/dokumenter/nou/?q=${encodeURIComponent(m)}" target="_blank" class="law-link nou-link" title="Søk i Regjeringen">${m}</a>`);

  // Prop. NNL eller Ot.prp. NN
  html = html.replace(/\b(Prop\.\s*\d+\s*[LST](?:\s*\(\d{4}[-–]\d{2,4}\))?)\b/g,
    m => `<a href="https://www.regjeringen.no/no/dokumenter/proposisjoner/?q=${encodeURIComponent(m)}" target="_blank" class="law-link prop-link" title="Søk i Regjeringen">${m}</a>`);

  editor.innerHTML = html;
  onEditorInput();
  showToast('✓ Lovreferanser konvertert til klikkbare lenker');
}

function clipSourcesIntoEditor() {
  const labels = Array.from(document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked'))
    .map(cb => { const l = cb.parentNode.querySelector('.source-label'); return l ? l.textContent.replace(/⚡/g,'').trim() : cb.value; });
  const custom = state.customSites.filter(s => s.checked).map(s => s.url);
  const all = [...labels, ...custom];
  if (!all.length) { showToast('⚠️ Ingen aktive kilder å sette inn.', 'warning'); return; }
  const date = new Date().toLocaleDateString('no-NO');
  const editor = document.getElementById('workbookEditor');
  if (editor) {
    editor.innerHTML += `<p><strong>📌 Søkegrunnlag (${date}):</strong><br><small>${all.join(' · ')}</small></p>`;
    onEditorInput();
  }
}

// ---- TABS ----
function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
}

// ---- URL PARAMS (DEEP LINKING) ----
function updateURLParams() {
  const params = new URLSearchParams();
  const q = document.getElementById('queryInput')?.value; if (q) params.set('q', q);
  const eng = document.getElementById('engineSelect')?.value; if (eng) params.set('eng', eng);
  const ex = document.getElementById('exactMatch')?.value; if (ex) params.set('exact', ex);
  const excl = document.getElementById('excludeWords')?.value; if (excl) params.set('excl', excl);
  const yf = document.getElementById('yearFrom')?.value; if (yf) params.set('yf', yf);
  const yt = document.getElementById('yearTo')?.value; if (yt) params.set('yt', yt);
  const ft = document.getElementById('fileType')?.value; if (ft) params.set('ft', ft);
  const checked = Array.from(document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked')).map(cb => cb.id);
  if (checked.length) params.set('src', checked.join(','));
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

function initURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('q')) document.getElementById('queryInput').value = p.get('q');
  if (p.has('eng')) document.getElementById('engineSelect').value = p.get('eng');
  if (p.has('exact')) document.getElementById('exactMatch').value = p.get('exact');
  if (p.has('excl')) document.getElementById('excludeWords').value = p.get('excl');
  if (p.has('yf')) document.getElementById('yearFrom').value = p.get('yf');
  if (p.has('yt')) document.getElementById('yearTo').value = p.get('yt');
  if (p.has('ft')) document.getElementById('fileType').value = p.get('ft');
  if (p.has('src')) {
    const ids = p.get('src').split(',');
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    ids.forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = true; });
    updateAllCategoryCounts();
  }
  updateLiveQueryPreview();
  onEngineChange();
}

function copyDeepLink() {
  updateURLParams();
  navigator.clipboard.writeText(window.location.href).then(() => showToast('✓ Direktelenke kopiert!'));
}

// ---- ENGINE NOTES ----
const ENGINE_NOTES = {
  google:    'Google: site:, filetype:, after:/before: dato-filtre. Beste allround-valg.',
  bing:      'Bing: site: og filetype:. Gir noen ganger andre treff enn Google på norske sider.',
  duckduckgo:'DuckDuckGo: site:-filter, ingen sporing. Ingen filtype-støtte.',
  scholar:   'Google Scholar: Akademiske artikler, juridisk teori og avhandlinger. Dato-filtre fungerer.',
  base:      'BASE: Europeisk åpen-tilgangs-søkemotor. Bruker url: i stedet for site:.',
  multitab:  '⚡ Multisøk: Åpner én fane per kilde med optimal søke-URL (portalsøk der tilgjengelig). Maks 10 faner.',
};

function onEngineChange() {
  const val = document.getElementById('engineSelect')?.value;
  const noteEl = document.getElementById('engineNote');
  if (noteEl) noteEl.textContent = ENGINE_NOTES[val] || '';
  updateLiveQueryPreview();
  updateURLParams();
  // Skjul/vis site-filter-advarsel for multitab
  const multiNote = document.getElementById('multiTabNote');
  if (multiNote) multiNote.style.display = val === 'multitab' ? 'block' : 'none';
}

// ---- EXPORT / IMPORT ----
function exportAllData() {
  saveCurrentWorkbookContent();
  const data = {
    version: APP_VERSION,
    exported: new Date().toISOString(),
    savedSearches: state.savedSearches,
    customSites: state.customSites,
    workbooks: state.workbooks,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rettskildesok-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('✓ Full backup eksportert som JSON');
}

function triggerImport() { document.getElementById('importFileInput')?.click(); }

function importAllData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.savedSearches) { state.savedSearches = data.savedSearches; localStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(state.savedSearches)); }
      if (data.customSites) { state.customSites = data.customSites; saveCustomSites(); renderCustomSites(); }
      if (data.workbooks) { state.workbooks = data.workbooks; saveWorkbooks(); renderWorkbookSelector(); loadActiveWorkbook(); }
      updateLibraryUI();
      showToast('✓ Backup gjenopprettet');
    } catch { showToast('⚠️ Ugyldig fil.', 'warning'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ---- STORAGE USAGE ----
function checkStorageUsage() {
  try {
    let total = 0;
    for (let k in localStorage) { if (localStorage.hasOwnProperty(k)) total += (localStorage[k].length + k.length) * 2; }
    const mb = total / 1024 / 1024;
    if (mb > MAX_STORAGE_WARN_MB) {
      showToast(`⚠️ Lokal lagring er ${mb.toFixed(1)}MB av ca. 5MB. Vurder å eksportere og slette gamle arbeidsbøker.`, 'warning');
    }
    const el = document.getElementById('storageUsage');
    if (el) el.textContent = `Lagring: ${mb.toFixed(1)}MB`;
  } catch {}
}

// ---- KEYBOARD SHORTCUTS ----
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('queryInput')?.focus(); }
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's' && !e.target.closest('[contenteditable]')) { e.preventDefault(); saveCurrentSearch(); }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); executeSearch(null); }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); printWorkbook(); }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); saveWorkbookVersion(); }
  });
}

// ---- TOAST ----
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.pointerEvents = 'auto';
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// ---- START ----
document.addEventListener('DOMContentLoaded', initApp);

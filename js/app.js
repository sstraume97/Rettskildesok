// =============================================================
// RETTSKILDESØK PRO – APPLIKASJONSLOGIKK
// =============================================================

const APP_VERSION = '2.0.0';
const STORAGE_KEYS = {
  theme: 'rsp_theme',
  history: 'rsp_history',
  savedSearches: 'rsp_saved',
  customSites: 'rsp_custom_sites',
  workbooks: 'rsp_workbooks',
  activeWb: 'rsp_active_wb',
  sidebarOpen: 'rsp_sidebar',
};

// ---- STATE ----
const state = {
  theme: localStorage.getItem(STORAGE_KEYS.theme) || 'light',
  history: JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]'),
  savedSearches: JSON.parse(localStorage.getItem(STORAGE_KEYS.savedSearches) || '[]'),
  customSites: JSON.parse(localStorage.getItem(STORAGE_KEYS.customSites) || '[]'),
  workbooks: JSON.parse(localStorage.getItem(STORAGE_KEYS.workbooks) || 'null') || [
    {
      id: 'default',
      title: 'Generell Kladdblokk',
      content: '<h3>📄 Din personlige arbeidsbenk</h3><p>Skriv, lim inn og organiser dine juridiske funn her. Bruk <strong>Autolenk</strong>-knappen for å gjøre referanser som <code>Lov-2005-06-17-90</code> eller <code>HR-2022-123-A</code> om til klikkbare lenker.</p>',
      created: new Date().toLocaleDateString('no-NO'),
    },
  ],
  activeWbId: localStorage.getItem(STORAGE_KEYS.activeWb) || 'default',
};

let autosaveTimer = null;

// ---- INIT ----
function initApp() {
  applyTheme(state.theme);
  renderAllSources();
  renderWorkbookSelector();
  loadActiveWorkbook();
  updateLibraryUI();
  initURLParams();
  setupKeyboardShortcuts();
  setupRawTextParser();

  // Restore sidebar state
  const sidebarWasOpen = localStorage.getItem(STORAGE_KEYS.sidebarOpen) !== 'false';
  if (window.innerWidth < 1024 || !sidebarWasOpen) {
    setSidebarOpen(false, false);
  } else {
    setSidebarOpen(true, false);
  }

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

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ---- SIDEBAR ----
function setSidebarOpen(open, save = true) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const main = document.getElementById('mainContent');

  if (open) {
    sidebar.classList.add('open');
    sidebar.classList.remove('closed');
    if (window.innerWidth < 1024 && overlay) overlay.classList.add('visible');
    if (window.innerWidth >= 1024) main.classList.add('sidebar-open');
  } else {
    sidebar.classList.remove('open');
    sidebar.classList.add('closed');
    if (overlay) overlay.classList.remove('visible');
    main.classList.remove('sidebar-open');
  }
  if (save) localStorage.setItem(STORAGE_KEYS.sidebarOpen, open);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  setSidebarOpen(sidebar.classList.contains('closed'));
}

// ---- RENDER SOURCES ----
function renderAllSources() {
  const container = document.getElementById('sourcesContainer');
  if (!container) return;

  container.innerHTML = SOURCE_CATEGORIES.map(cat => `
    <div class="source-category" id="cat_${cat.id}">
      <div class="category-header">
        <span class="category-dot ${cat.colorClass}"></span>
        <span class="category-title">${cat.title}</span>
        <button class="cat-toggle-btn" onclick="toggleCategory('${cat.id}')" title="Fold/utfold">▾</button>
      </div>
      <div class="source-list" id="list_${cat.id}">
        ${cat.sources.map(src => `
          <div class="source-item ${cat.colorClass}" data-keywords="${(src.keywords || []).join(' ')}" id="item_${src.id}">
            <input type="checkbox" id="${src.id}" value="${src.value}"
              ${src.defaultChecked ? 'checked' : ''}
              onchange="onSourceChange()">
            <label for="${src.id}">
              <span class="source-label">${src.label}</span>
              <span class="source-desc">${src.desc}</span>
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  renderCustomSites();
}

function toggleCategory(catId) {
  const list = document.getElementById(`list_cat_${catId}`);
  const btn = document.querySelector(`#cat_cat_${catId} .cat-toggle-btn`);
  if (!list) return;
  const isHidden = list.style.display === 'none';
  list.style.display = isHidden ? '' : 'none';
  if (btn) btn.textContent = isHidden ? '▾' : '▸';
}

function onSourceChange() {
  updateURLParams();
}

// ---- SOURCE FILTER ----
function filterSources(query) {
  const q = (query || '').toLowerCase().trim();
  document.querySelectorAll('.source-item').forEach(item => {
    if (!q) {
      item.style.display = '';
      return;
    }
    const label = (item.querySelector('.source-label')?.textContent || '').toLowerCase();
    const desc = (item.querySelector('.source-desc')?.textContent || '').toLowerCase();
    const kw = (item.getAttribute('data-keywords') || '').toLowerCase();
    item.style.display = (label.includes(q) || desc.includes(q) || kw.includes(q)) ? '' : 'none';
  });
}

function toggleAllSources(checked) {
  document.querySelectorAll('.source-item:not([style*="display: none"]) input[type="checkbox"]')
    .forEach(cb => { cb.checked = checked; });
  updateURLParams();
}

// ---- CUSTOM SITES ----
function addCustomSite() {
  const input = document.getElementById('customSiteInput');
  let url = (input.value || '').trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!url) return;
  if (state.customSites.some(s => s.url === url)) {
    showToast('Siden er allerede lagt til.');
    return;
  }
  state.customSites.push({ id: Date.now(), url, checked: true });
  localStorage.setItem(STORAGE_KEYS.customSites, JSON.stringify(state.customSites));
  input.value = '';
  renderCustomSites();
  updateURLParams();
}

function removeCustomSite(id) {
  state.customSites = state.customSites.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.customSites, JSON.stringify(state.customSites));
  renderCustomSites();
  updateURLParams();
}

function toggleCustomSite(id, checked) {
  const site = state.customSites.find(s => s.id === id);
  if (site) site.checked = checked;
  localStorage.setItem(STORAGE_KEYS.customSites, JSON.stringify(state.customSites));
  updateURLParams();
}

function renderCustomSites() {
  const container = document.getElementById('customSitesContainer');
  if (!container) return;
  if (state.customSites.length === 0) {
    container.innerHTML = '<span class="empty-note">Ingen egne sider lagt til ennå.</span>';
    return;
  }
  container.innerHTML = state.customSites.map(s => `
    <div class="custom-site-tag">
      <input type="checkbox" id="cs_${s.id}" ${s.checked ? 'checked' : ''} onchange="toggleCustomSite(${s.id}, this.checked)">
      <label for="cs_${s.id}">${s.url}</label>
      <button class="remove-site-btn" onclick="removeCustomSite(${s.id})" title="Fjern">×</button>
    </div>
  `).join('');
}

// ---- QUERY BUILDER ----
function buildQuery() {
  const rawQuery = (document.getElementById('queryInput')?.value || '').trim();
  const engineId = document.getElementById('engineSelect')?.value || 'google';
  const exactPhrase = (document.getElementById('exactMatch')?.value || '').trim();
  const excludeWords = (document.getElementById('excludeWords')?.value || '').trim();
  const fileType = document.getElementById('fileType')?.value || '';
  const yearFrom = document.getElementById('yearFrom')?.value || '';
  const yearTo = document.getElementById('yearTo')?.value || '';

  const engine = SEARCH_ENGINES.find(e => e.id === engineId) || SEARCH_ENGINES[0];

  // Synonym expansion (exact match on single term)
  let expandedQuery = rawQuery;
  if (rawQuery && JURIDISK_TESAURUS[rawQuery.toLowerCase()]) {
    const syns = JURIDISK_TESAURUS[rawQuery.toLowerCase()];
    expandedQuery = `(${rawQuery} OR ${syns.join(' OR ')})`;
  }

  const parts = [];
  if (expandedQuery) parts.push(expandedQuery);
  if (exactPhrase) parts.push(`"${exactPhrase}"`);
  if (excludeWords) {
    excludeWords.split(/\s+/).filter(Boolean).forEach(w => parts.push(`-${w}`));
  }
  if (fileType && engine.supportsFiletype) parts.push(`filetype:${fileType}`);

  // Date filters (Google/Scholar)
  if (engine.supportsDateFilter) {
    if (engine.dateFormat === 'google' || engine.dateFormat === undefined) {
      if (yearFrom) parts.push(`after:${yearFrom}-01-01`);
      if (yearTo) parts.push(`before:${yearTo}-12-31`);
    }
  }

  // Site filters
  if (engine.supportsSiteFilter !== false) {
    const checkedSources = Array.from(
      document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    const allSites = [];
    checkedSources.forEach(val => {
      val.split('|').forEach(site => allSites.push(site.trim()));
    });
    state.customSites.forEach(s => { if (s.checked) allSites.push(s.url); });

    if (allSites.length > 0) {
      const prefix = engine.sitePrefix || 'site:';
      const siteFilter = allSites.map(s => `${prefix}${s}`).join(' OR ');
      parts.push(allSites.length > 1 ? `(${siteFilter})` : siteFilter);
    }
  }

  const queryString = parts.join(' ').replace(/\s+/g, ' ').trim();
  return { engine, queryString, rawQuery, yearFrom, yearTo, exactPhrase, excludeWords };
}

function getCheckedSourceIds() {
  return Array.from(
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked')
  ).map(cb => cb.id);
}

// ---- EXECUTE SEARCH ----
function executeSearch(e) {
  if (e) e.preventDefault();

  const { engine, queryString, rawQuery } = buildQuery();

  const checkedCount = document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked').length
    + state.customSites.filter(s => s.checked).length;

  if (!engine.direct && checkedCount === 0) {
    showToast('⚠️ Velg minst én kilde i sidepanelet.', 'warning');
    return;
  }

  if (!queryString) {
    showToast('⚠️ Skriv inn et søkeord.', 'warning');
    return;
  }

  // Build final URL
  let url;
  if (engine.id === 'scholar') {
    const yearFrom = document.getElementById('yearFrom')?.value;
    const yearTo = document.getElementById('yearTo')?.value;
    url = engine.baseUrl + encodeURIComponent(queryString);
    if (yearFrom) url += `&as_ylo=${yearFrom}`;
    if (yearTo) url += `&as_yhi=${yearTo}`;
  } else {
    url = engine.baseUrl + encodeURIComponent(queryString);
  }

  addToHistory(engine.id, rawQuery, queryString);
  createAutoWorkbook(rawQuery, queryString);
  updateURLParams();

  window.open(url, '_blank');

  // Show the compiled string briefly
  showCompiledString(queryString);
}

function copyQueryString() {
  const { queryString } = buildQuery();
  if (!queryString) { showToast('Ingen søkestreng å kopiere.', 'warning'); return; }
  navigator.clipboard.writeText(queryString).then(() => {
    showToast('✓ Søkestreng kopiert til utklippstavlen!');
  });
}

// ---- COMPILED STRING DISPLAY ----
function showCompiledString(str) {
  const el = document.getElementById('compiledStringDisplay');
  const code = document.getElementById('compiledStringCode');
  if (el && code) {
    code.textContent = str;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }
}

// ---- DATE HELPERS ----
function setRelativeTime(yearsBack) {
  const currentYear = new Date().getFullYear();
  document.getElementById('yearFrom').value = currentYear - yearsBack;
  document.getElementById('yearTo').value = currentYear;
  document.getElementById('advancedSection').open = true;
  updateURLParams();
}

// ---- OPERATOR HELPERS ----
function insertOperator(type) {
  const input = document.getElementById('queryInput');
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const val = input.value;
  const sel = val.substring(start, end);

  const replacements = {
    phrase: `"${sel || 'frase'}"`,
    and: ` ${sel || 'ord1'} AND ord2 `,
    or: ` ${sel || 'ord1'} OR ord2 `,
    not: ` -${sel || 'utelatOrd'}`,
    siteNot: ` -site:${sel || 'domene.no'}`,
    wildcard: `${sel || 'arbeids'}*`,
    near: ` ${sel || 'ord1'} NEAR ord2 `,
  };

  const replacement = replacements[type] || '';
  input.value = val.substring(0, start) + replacement + val.substring(end);
  input.focus();
  input.setSelectionRange(start + replacement.length, start + replacement.length);
  updateURLParams();
}

// ---- BUNDLES ----
function applyBundle(bundleId) {
  const bundle = BUNDLES.find(b => b.id === bundleId);
  if (!bundle) return;

  // Deselect all first
  document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });

  if (bundle.sourceIds === null) {
    // Select all
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = true; });
  } else {
    bundle.sourceIds.forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = true;
    });
  }
  updateURLParams();
  showToast(`✓ Bundle "${bundle.label}" lastet`);
}

// ---- RAW TEXT PARSER ----
function setupRawTextParser() {
  const textarea = document.getElementById('rawTextParser');
  if (!textarea) return;
  textarea.addEventListener('input', () => {
    const text = textarea.value.toLowerCase();
    if (!text.trim()) return;

    let hits = 0;
    SOURCE_CATEGORIES.forEach(cat => {
      cat.sources.forEach(src => {
        const keywords = src.keywords || [];
        const matches = keywords.some(kw => text.includes(kw.toLowerCase()));
        const cb = document.getElementById(src.id);
        if (cb && matches) {
          cb.checked = true;
          hits++;
        }
      });
    });

    if (hits > 0) {
      updateURLParams();
      showToast(`✓ ${hits} relevante kilder aktivert automatisk`);
    }
  });
}

// ---- HISTORY ----
function addToHistory(engineId, rawQuery, queryString) {
  if (!rawQuery && !queryString) return;
  state.history.unshift({
    id: Date.now(),
    engine: engineId,
    query: rawQuery,
    fullString: queryString,
    time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString('no-NO'),
  });
  if (state.history.length > 30) state.history = state.history.slice(0, 30);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
  updateLibraryUI();
}

// ---- SAVED SEARCHES ----
function saveCurrentSearch() {
  const { rawQuery, queryString, engine } = buildQuery();
  const name = prompt('Gi søket et navn:', rawQuery || 'Mitt juridiske søk');
  if (!name) return;

  const checkedIds = getCheckedSourceIds();
  state.savedSearches.unshift({
    id: Date.now(),
    name,
    engine: engine.id,
    query: rawQuery,
    queryString,
    sourceIds: checkedIds,
    date: new Date().toLocaleDateString('no-NO'),
    // advanced params
    exactMatch: document.getElementById('exactMatch')?.value || '',
    excludeWords: document.getElementById('excludeWords')?.value || '',
    fileType: document.getElementById('fileType')?.value || '',
    yearFrom: document.getElementById('yearFrom')?.value || '',
    yearTo: document.getElementById('yearTo')?.value || '',
  });

  localStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(state.savedSearches));
  updateLibraryUI();
  showToast('✓ Søket er lagret i biblioteket');
}

function loadSavedSearch(id) {
  const saved = state.savedSearches.find(s => s.id === id);
  if (!saved) return;

  // Restore engine
  const engineSel = document.getElementById('engineSelect');
  if (engineSel) engineSel.value = saved.engine;

  // Restore query
  const queryInput = document.getElementById('queryInput');
  if (queryInput) queryInput.value = saved.query || '';

  // Restore advanced params
  if (document.getElementById('exactMatch')) document.getElementById('exactMatch').value = saved.exactMatch || '';
  if (document.getElementById('excludeWords')) document.getElementById('excludeWords').value = saved.excludeWords || '';
  if (document.getElementById('fileType')) document.getElementById('fileType').value = saved.fileType || '';
  if (document.getElementById('yearFrom')) document.getElementById('yearFrom').value = saved.yearFrom || '';
  if (document.getElementById('yearTo')) document.getElementById('yearTo').value = saved.yearTo || '';

  // Restore sources
  document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  (saved.sourceIds || []).forEach(id => {
    const cb = document.getElementById(id);
    if (cb) cb.checked = true;
  });

  updateURLParams();
  switchTab('search-tab');
  showToast(`✓ Søk "${saved.name}" lastet inn`);
}

function deleteSavedSearch(id, e) {
  e.stopPropagation();
  state.savedSearches = state.savedSearches.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(state.savedSearches));
  updateLibraryUI();
}

function updateLibraryUI() {
  const savedList = document.getElementById('savedSearchesList');
  const historyList = document.getElementById('historyList');
  const tabBtn = document.getElementById('libraryTabBtn');

  if (tabBtn) tabBtn.textContent = `📚 Bibliotek (${state.savedSearches.length})`;

  if (savedList) {
    if (state.savedSearches.length === 0) {
      savedList.innerHTML = '<p class="empty-note">Ingen lagrede søk ennå. Søk og klikk "Lagre søk".</p>';
    } else {
      savedList.innerHTML = state.savedSearches.map(s => `
        <div class="list-item" onclick="loadSavedSearch(${s.id})">
          <div class="list-item-info">
            <div class="list-item-title">${s.name}
              <span class="engine-badge">${(s.engine || '').toUpperCase()}</span>
            </div>
            <div class="list-item-meta">Lagret ${s.date} · "${s.query || 'avansert'}" · ${(s.sourceIds || []).length} kilder</div>
          </div>
          <button class="btn-icon danger" onclick="deleteSavedSearch(${s.id}, event)" title="Slett">🗑</button>
        </div>
      `).join('');
    }
  }

  if (historyList) {
    if (state.history.length === 0) {
      historyList.innerHTML = '<p class="empty-note">Ingen søkehistorikk ennå.</p>';
    } else {
      historyList.innerHTML = state.history.map(h => `
        <div class="list-item history-item" onclick="restoreFromHistory(${h.id})">
          <div>
            <span class="list-item-title">🔍 ${h.query || '[Avansert]'}</span>
            <div class="list-item-meta">${h.date} kl. ${h.time} · ${(h.engine || '').toUpperCase()}</div>
            <div class="query-string-preview">${h.fullString || ''}</div>
          </div>
        </div>
      `).join('');
    }
  }
}

function restoreFromHistory(id) {
  const h = state.history.find(item => item.id === id);
  if (!h) return;
  const engineSel = document.getElementById('engineSelect');
  if (engineSel) engineSel.value = h.engine;
  const queryInput = document.getElementById('queryInput');
  if (queryInput) queryInput.value = h.query || '';
  switchTab('search-tab');
  showToast('✓ Historisk søk gjenopprettet');
}

// ---- WORKBOOK ----
function createAutoWorkbook(query, fullString) {
  const now = new Date();
  const id = 'wb_' + now.getTime();
  const title = `Søk: ${query || '[Avansert]'} (${now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })})`;

  const content = `
    <h3>📂 ${query || 'Avansert søk'}</h3>
    <p><small style="color:#64748b;">Opprettet ${now.toLocaleDateString('no-NO')} kl. ${now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}</small></p>
    <p><strong>Søkestreng:</strong></p>
    <pre style="background:var(--code-bg); padding:10px; border-radius:6px; font-size:0.85rem; white-space:pre-wrap; word-break:break-all;">${fullString}</pre>
    <hr>
    <p><em>Skriv inn dine funn og notater her...</em></p>
  `;

  state.workbooks.unshift({ id, title, content, created: now.toLocaleDateString('no-NO') });
  if (state.workbooks.length > 50) state.workbooks = state.workbooks.slice(0, 50);
  state.activeWbId = id;

  localStorage.setItem(STORAGE_KEYS.workbooks, JSON.stringify(state.workbooks));
  localStorage.setItem(STORAGE_KEYS.activeWb, id);

  renderWorkbookSelector();
  loadActiveWorkbook();
}

function renderWorkbookSelector() {
  const sel = document.getElementById('workbookSelector');
  if (!sel) return;
  sel.innerHTML = state.workbooks.map(wb =>
    `<option value="${wb.id}">${wb.title}</option>`
  ).join('');
  sel.value = state.activeWbId;
}

function loadActiveWorkbook() {
  const wb = state.workbooks.find(w => w.id === state.activeWbId) || state.workbooks[0];
  if (!wb) return;
  state.activeWbId = wb.id;
  const editor = document.getElementById('workbookEditor');
  if (editor) editor.innerHTML = wb.content;
  const sel = document.getElementById('workbookSelector');
  if (sel) sel.value = wb.id;
}

function switchWorkbook(id) {
  saveCurrentWorkbookContent();
  state.activeWbId = id;
  localStorage.setItem(STORAGE_KEYS.activeWb, id);
  loadActiveWorkbook();
}

function saveCurrentWorkbookContent() {
  const wb = state.workbooks.find(w => w.id === state.activeWbId);
  const editor = document.getElementById('workbookEditor');
  if (wb && editor) {
    wb.content = editor.innerHTML;
    localStorage.setItem(STORAGE_KEYS.workbooks, JSON.stringify(state.workbooks));
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
  el.style.opacity = '1';
  el.textContent = '✓ Lagret';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function deleteCurrentWorkbook() {
  if (state.workbooks.length <= 1) { showToast('Kan ikke slette den eneste arbeidsboken.', 'warning'); return; }
  if (!confirm('Slette denne arbeidsboken permanent?')) return;
  state.workbooks = state.workbooks.filter(w => w.id !== state.activeWbId);
  state.activeWbId = state.workbooks[0].id;
  localStorage.setItem(STORAGE_KEYS.workbooks, JSON.stringify(state.workbooks));
  localStorage.setItem(STORAGE_KEYS.activeWb, state.activeWbId);
  renderWorkbookSelector();
  loadActiveWorkbook();
}

function newWorkbook() {
  const title = prompt('Navn på ny arbeidsbok:', 'Ny arbeidsbok');
  if (!title) return;
  const id = 'wb_' + Date.now();
  state.workbooks.unshift({
    id, title,
    content: `<h3>${title}</h3><p><em>Start å skrive her...</em></p>`,
    created: new Date().toLocaleDateString('no-NO'),
  });
  state.activeWbId = id;
  localStorage.setItem(STORAGE_KEYS.workbooks, JSON.stringify(state.workbooks));
  localStorage.setItem(STORAGE_KEYS.activeWb, id);
  renderWorkbookSelector();
  loadActiveWorkbook();
}

function exportWorkbookText() {
  saveCurrentWorkbookContent();
  const wb = state.workbooks.find(w => w.id === state.activeWbId);
  if (!wb) return;
  const div = document.createElement('div');
  div.innerHTML = wb.content;
  const text = div.innerText;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${wb.title.replace(/[^a-z0-9æøåÆØÅ]/gi, '_')}.txt`;
  a.click();
}

function insertFormatting(command, value) {
  document.execCommand(command, false, value || null);
  document.getElementById('workbookEditor')?.focus();
  onEditorInput();
}

function insertHeading(level) {
  document.execCommand('formatBlock', false, `h${level}`);
  onEditorInput();
}

function runLawAutolink() {
  const editor = document.getElementById('workbookEditor');
  if (!editor) return;
  let html = editor.innerHTML;

  // HR-YYYY-NNN-A (ny Høyesterett-referanse)
  html = html.replace(/\b(HR-\d{4}-\d+-[A-Z])\b/g, match =>
    `<a href="https://lovdata.no/sok?q=${encodeURIComponent(match)}" target="_blank" class="law-link hr-link">${match}</a>`
  );

  // Rt-YYYY-NNN (historisk Høyesterett)
  html = html.replace(/\b(Rt-\d{4}-\d+)\b/g, match =>
    `<a href="https://lovdata.no/sok?q=${encodeURIComponent(match)}" target="_blank" class="law-link rt-link">${match}</a>`
  );

  // Lov-YYYY-MM-DD eller Lov-YYYY-MM-DD-NN
  html = html.replace(/\b(Lov-\d{4}-\d{2}-\d{2}(?:-\d+)?)\b/gi, match =>
    `<a href="https://lovdata.no/dokument/NL/${match.toLowerCase()}" target="_blank" class="law-link lov-link">${match}</a>`
  );

  // FOR-YYYY-MM-DD-NN (forskrift)
  html = html.replace(/\b(FOR-\d{4}-\d{2}-\d{2}-\d+)\b/gi, match =>
    `<a href="https://lovdata.no/dokument/SF/${match.toLowerCase()}" target="_blank" class="law-link for-link">${match}</a>`
  );

  // § XX og §§ XX (generisk paragraflenke til Lovdata-søk)
  // (skip – for komplisert uten lovreferanse)

  editor.innerHTML = html;
  onEditorInput();
  showToast('✓ Lovreferanser koblet til Lovdata');
}

function clipSourcesIntoEditor() {
  const checkedLabels = Array.from(
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked')
  ).map(cb => {
    const label = cb.parentNode.querySelector('.source-label');
    return label ? label.textContent.trim() : cb.value;
  });

  const customChecked = state.customSites.filter(s => s.checked).map(s => s.url);
  const all = [...checkedLabels, ...customChecked];

  if (all.length === 0) { showToast('⚠️ Ingen aktive kilder å sette inn.', 'warning'); return; }

  const dateStr = new Date().toLocaleDateString('no-NO');
  const insert = `<p><strong>📌 Søkegrunnlag (${dateStr}):</strong><br><small style="color:#64748b;">${all.join(' · ')}</small></p>`;

  const editor = document.getElementById('workbookEditor');
  if (editor) {
    editor.innerHTML += insert;
    onEditorInput();
  }
}

// ---- TABS ----
function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
}

// ---- URL PARAMS (DEEP LINKING) ----
function updateURLParams() {
  const params = new URLSearchParams();
  const q = document.getElementById('queryInput')?.value;
  if (q) params.set('q', q);
  const eng = document.getElementById('engineSelect')?.value;
  if (eng) params.set('eng', eng);
  const exact = document.getElementById('exactMatch')?.value;
  if (exact) params.set('exact', exact);
  const excl = document.getElementById('excludeWords')?.value;
  if (excl) params.set('excl', excl);
  const yf = document.getElementById('yearFrom')?.value;
  if (yf) params.set('yf', yf);
  const yt = document.getElementById('yearTo')?.value;
  if (yt) params.set('yt', yt);
  const ft = document.getElementById('fileType')?.value;
  if (ft) params.set('ft', ft);

  const checked = Array.from(
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]:checked')
  ).map(cb => cb.id);
  if (checked.length > 0) params.set('src', checked.join(','));

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

function initURLParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) document.getElementById('queryInput').value = params.get('q');
  if (params.has('eng')) document.getElementById('engineSelect').value = params.get('eng');
  if (params.has('exact')) document.getElementById('exactMatch').value = params.get('exact');
  if (params.has('excl')) document.getElementById('excludeWords').value = params.get('excl');
  if (params.has('yf')) document.getElementById('yearFrom').value = params.get('yf');
  if (params.has('yt')) document.getElementById('yearTo').value = params.get('yt');
  if (params.has('ft')) document.getElementById('fileType').value = params.get('ft');

  if (params.has('src')) {
    const ids = params.get('src').split(',');
    // Deselect defaults first
    document.querySelectorAll('#sourcesContainer input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    ids.forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = true;
    });
  }
}

function copyDeepLink() {
  updateURLParams();
  navigator.clipboard.writeText(window.location.href).then(() => {
    showToast('✓ Direktelenke til dette søket er kopiert!');
  });
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
  a.download = `rettskildesok-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast('✓ Full backup eksportert som JSON');
}

function triggerImport() {
  document.getElementById('importFileInput')?.click();
}

function importAllData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.savedSearches) {
        state.savedSearches = data.savedSearches;
        localStorage.setItem(STORAGE_KEYS.savedSearches, JSON.stringify(state.savedSearches));
      }
      if (data.customSites) {
        state.customSites = data.customSites;
        localStorage.setItem(STORAGE_KEYS.customSites, JSON.stringify(state.customSites));
        renderCustomSites();
      }
      if (data.workbooks) {
        state.workbooks = data.workbooks;
        localStorage.setItem(STORAGE_KEYS.workbooks, JSON.stringify(state.workbooks));
        renderWorkbookSelector();
        loadActiveWorkbook();
      }
      updateLibraryUI();
      showToast('✓ Backup gjenopprettet fra JSON');
    } catch {
      showToast('⚠️ Ugyldig fil – kunne ikke importere.', 'warning');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ---- KEYBOARD SHORTCUTS ----
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Alt+B – toggle sidebar
    if (e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
    // Ctrl+Shift+F – focus search
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.getElementById('queryInput')?.focus();
    }
    // Ctrl+S – save search
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's' && !e.target.closest('[contenteditable]')) {
      e.preventDefault();
      saveCurrentSearch();
    }
    // Ctrl+Enter – execute search
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      executeSearch(null);
    }
  });
}

// ---- TOAST NOTIFICATIONS ----
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---- START ----
document.addEventListener('DOMContentLoaded', initApp);

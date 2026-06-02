# RettskildeSøk PRO

**Profesjonell søkeaggregator for norske og internasjonale rettskilder**

🔗 **Live demo:** `https://[ditt-brukernavn].github.io/rettskildesok-pro/`

---

## Hva er dette?

RettskildeSøk PRO er et gratis, åpent verktøy for juridisk research. Det hjelper deg å bygge presisjons-søkestrenger og sende dem til riktige rettskilder – alt fra ett sted.

### Funksjoner

- **60+ rettskilder** kategorisert etter rettslig vekt (lover, forarbeider, domstoler, nemnder, EU/EØS, internasjonal rett)
- **7 søkemotorer:** Google, Bing, DuckDuckGo, Google Scholar, BASE, Lovdata direkte, Rettsdata direkte
- **Boolske operatorer** med ett klikk (AND, OR, -ekskluder, frase, trunkering*)
- **Fagområde-bundles** for rask konfigurasjon (arbeidsrett, forvaltning, strafferett osv.)
- **Juridisk tesaurus** – automatisk synonymutvidelse
- **Tekstparser** – haker automatisk av relevante kilder basert på limt inn tekst
- **Arbeidsbok** med autolenking av lovreferanser til Lovdata
- **Deep linking** – del eksakte søk som URL
- **Mørk/lys modus**, tastatursnarveier, responsivt design
- **JSON-backup/gjenopprett** – lokal lagring, ingen server
- Fungerer **100% offline** etter første lasting

---

## Kom i gang (GitHub Pages)

### 1. Fork eller klon repositoriet

```bash
git clone https://github.com/[ditt-brukernavn]/rettskildesok-pro.git
cd rettskildesok-pro
```

### 2. Aktiver GitHub Pages

1. Gå til **Settings** → **Pages** i ditt GitHub-repositorium
2. Under **Source**, velg `Deploy from a branch`
3. Velg `main`-grenen og `/ (root)`-mappen
4. Klikk **Save**

GitHub Pages er live på `https://[ditt-brukernavn].github.io/rettskildesok-pro/` innen noen minutter.

### 3. (Valgfritt) Eget domene

Legg til en `CNAME`-fil i rotmappen med ditt domene:

```
rettskildesok.mittdomene.no
```

---

## Filstruktur

```
rettskildesok-pro/
├── index.html          ← Hovedfil (HTML-struktur og UI)
├── css/
│   └── style.css       ← Komplett stilsett (lys/mørk modus)
├── js/
│   ├── sources.js      ← Alle rettskilder, søkemotorer og bundles
│   └── app.js          ← Applikasjonslogikk
├── README.md           ← Denne filen
└── .nojekyll           ← Hindrer Jekyll-prosessering (nødvendig for GitHub Pages)
```

---

## Tilpasning

### Legge til nye rettskilder

Rediger `js/sources.js` og legg til i `SOURCE_CATEGORIES`-arrayen:

```javascript
{
  id: 'min_ny_kilde',
  label: 'Min nye kilde',
  desc: 'Beskrivelse av hva denne kilden inneholder',
  value: 'domene.no/sti',          // URL som brukes i site:-filter
  defaultChecked: false,
  keywords: ['nøkkelord1', 'nøkkelord2'],  // for automatisk tekstparser
}
```

### Legge til nye søkemotorer

```javascript
{
  id: 'min_motor',
  label: '🔍 Min motor',
  baseUrl: 'https://søkemotor.no/search?q=',
  supportsDateFilter: false,
  supportsSiteFilter: true,
  supportsFiletype: false,
}
```

---

## Tastatursnarveier

| Snarvei | Funksjon |
|---------|----------|
| `Ctrl+Enter` | Utfør søk |
| `Ctrl+Shift+F` | Hopp til søkefelt |
| `Ctrl+S` | Lagre søkekonfigurasjon |
| `Alt+B` | Åpne/lukk kildeliste |

---

## Teknisk

- **Arkitektur:** Ren HTML5, CSS3 og Vanilla JavaScript
- **Avhengigheter:** Ingen – null eksterne biblioteker
- **Lagring:** `localStorage` (nettleser-lokalt, ingen server)
- **Offline:** Fungerer uten internett etter første lasting (SPA)
- **Tilgjengelighet:** Semantisk HTML, ARIA-labels, tastaturnavigasjon

---

## Lisens

MIT-lisens – fritt å bruke, modifisere og distribuere.

---

*Laget for norske jurister, advokater, studenter og alle andre som driver med juridisk research.*

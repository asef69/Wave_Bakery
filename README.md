# WaveBakery

An educational cooking game for **CSE 220 — Signals and Linear Systems**. Every
ingredient is a signal, and every kitchen station is a signal-processing operation.
You cook a recipe by washing, mixing, seasoning, marinating, cooking, baking and
delivering signals. At the end, the server compares your dish with the recipe's
reference dish and gives it a score.

| Kitchen action | Signals & Systems concept |
| --- | --- |
| Washing an ingredient | Low-pass filtering (noise removal) |
| Mixing in the bowl | Linear superposition, Σ g·x / √K |
| Seasoning | Amplitude and time scaling, A · x(αt) |
| Marinating | Time shift, x(t − t₀) |
| Cooking (grill / bake / boil / fry) | Convolution with an impulse response, x * h |
| Precision Oven | Sampling and Nyquist, aliasing, FFT, equalising, IFFT |
| System Delivery | Z-plane poles and zeros, H(z), frequency response, stability |
| Tasting / scoring | Correlation, NRMSE, SNR, spectral similarity |

---

## Features

- **5 recipes** across 3 tiers: Burger and Sandwich (Easy), Cake and Noodles
  (Medium), Chicken Fry (Hard). Each recipe has its own ingredients, seasoning,
  marinating time and cooking method (grill, bake, boil or fry).
- **A full station pipeline:** Pantry → Washing → Mixing → Seasoning → Marinating
  → Cooking → Check Dish → Precision Oven → System Delivery → Score.
- **Finishing problems to solve:**
  - Cooking leaves a *burnt overtone* between the dish's harmonics. You remove it
    in the Precision Oven with a notch or cutoff, sampling at fs ≥ 2·fmax.
  - The delivery cart adds a *road vibration*. You cancel it with a notch filter
    on the z-plane while keeping the cart stable (every pole inside the unit
    circle).
- **Server-authoritative scoring:** the FastAPI backend rebuilds the dish from
  your settings and judges it, so the browser can't fake a score.
- **4 difficulties** with timers and score multipliers: Easy 7:00 (×0.8),
  Medium 5:00 (×1.0), Hard 3:10 (×1.25), MasterChef 2:00 (×1.5). A 3-2-1-GO
  countdown starts each run, and you can pause at any time.
- **Accounts, recipe book, tier unlocking and a leaderboard** (top 5, with a
  "See all" view). Rankings are grouped into scoring seasons, so older runs
  scored under older rules don't mix with current ones.
- **Signal Playground:** every station as a free sandbox, on any ingredient or
  oscillator, plus a Tasting lab (how a dish is scored) and a Full Chain lab (a
  whole recipe, station by station).
- **Sound:** every signal can be played back, cooking sounds play while the
  convolution slider is held, and buttons click. Volume and on/off are in
  Settings.

---

## Tech stack

| Part | Stack |
| --- | --- |
| Frontend | React 19, TypeScript, TanStack Router / Start, Vite 8, Tailwind CSS, Vitest |
| Backend | Python, FastAPI, SQLAlchemy (SQLite), NumPy, SciPy, pytest |

---

## Getting started

### Requirements

- **Python 3.11+**
- **Node.js 20.19+ or 22.12+** (Vite 8)

### 1. Install the backend

```bash
cd backend
python -m venv .signal
.signal\Scripts\activate        # Windows
# source .signal/bin/activate   # macOS / Linux
pip install -r requirements.txt
cd ..
```

### 2. Install the frontend

```bash
cd frontend
npm install
cd ..
```

### 3. Run both

```bash
python run.py
```

On Windows you can also double-click `start.bat`. The runner:

1. starts the API at **http://127.0.0.1:8000** (health check: `/api/health`);
2. starts the web app at **http://localhost:5173** once the API is up, and opens
   it in your browser.

Press `Ctrl+C` to stop both.

The SQLite database (`backend/wavekitchen.db`) is created and seeded
automatically on first start.

To run each part on its own:

```bash
# backend
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# frontend (in another terminal)
cd frontend
npm run dev
```

### Configuration (optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `WK_DATABASE_URL` | `sqlite:///backend/wavekitchen.db` | Database location |
| `WK_CORS_ORIGINS` | `http://localhost:5173`, `http://127.0.0.1:5173`, … | Allowed browser origins (comma-separated) |

---

## How scoring works

The backend rebuilds your dish from the settings you chose at each station and
compares it with the recipe's reference dish:

```
dish score  = 100 · (0.40 · spectral + 0.35 · correlation + 0.25 · SNR)
raw         = dish score · (0.72 + 0.28 · prep / 100)
score       = 100 · (raw / 100) ^ (1 / tolerance)
stars       = 5 / 4 / 3 / 2 / 1 at 92 / 80 / 66 / 50 / 32
total score = round(score · 10 · d) + round(min(2 · seconds left, 300) · d)
```

- `d` is the difficulty multiplier (0.8, 1.0, 1.25 or 1.5).
- **spectral** is the cosine similarity of the two dB spectra, measured over the
  40 dB below the target's peak.
- **correlation** is the best-lag normalised cross-correlation.
- **SNR** is target energy over error energy, mapped from −5 dB to 25 dB.
- **prep** covers how well you washed and prepared the ingredients.

The live **match %** shown inside each station is a quicker measure:
50% shape correlation plus 50% NRMSE level match. That's why it can differ from
the final dish score.

The full formulas are in
[`docs/WaveBakery_Detailed_Architecture.pdf`](docs/WaveBakery_Detailed_Architecture.pdf).

---

## Project structure

```
Wave_Kitchen/
├── run.py, start.bat, start.ps1   # one-command runner (backend + frontend)
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app, startup seeding, routers
│   │   ├── gameplay.py            # server-side dish rebuild, scoring, difficulties, seasons
│   │   ├── delivery.py            # burnt overtone, oven and cart gains (mirrors the frontend)
│   │   ├── dsp/                   # core DSP, ingredient synthesis, metrics, pipeline, z-systems
│   │   ├── routers/               # players, catalogue, sessions, leaderboard, dsp
│   │   ├── models.py, schemas.py, database.py, seed.py, config.py
│   └── tests/                     # pytest suite
├── frontend/
│   ├── src/
│   │   ├── routes/                # one file per screen/station (TanStack file routes)
│   │   ├── lib/                   # pipeline, signals, recipes, dsp, precision-oven-dsp,
│   │   │                          # z-system, delivery, playground, audio, sfx, api
│   │   └── components/            # game UI, system (z-plane plotter), playground labs, ui
│   ├── sounds/                    # cooking sound effects
│   └── tests/                     # Vitest suite
└── docs/                          # architecture and gameplay PDFs (LaTeX sources), slide deck
```

---

## Tests

```bash
# backend
cd backend
python -m pytest -q

# frontend
cd frontend
npm test            # Vitest
npx tsc --noEmit    # type-check
npm run lint        # ESLint + Prettier
```

---

## Documentation

- [`docs/WaveBakery_Gameplay_Overview.pdf`](docs/WaveBakery_Gameplay_Overview.pdf):
  each station, what the player does, and the concept behind it.
- [`docs/WaveBakery_Detailed_Architecture.pdf`](docs/WaveBakery_Detailed_Architecture.pdf):
  system design, the signal pipeline, and the scoring formulas.
- [`docs/WaveBakery_Presentation.pdf`](docs/WaveBakery_Presentation.pdf):
  the project presentation.

---

## Team

- Kazi Asef Kabir
- Tajrian Shams

CSE 220 — Signals and Linear Systems.

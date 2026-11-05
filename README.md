# 🩸 LifeDrop — Blood Donation Camp Web App

An interactive, animated, dependency-free website for organising and promoting blood donation camps.
Built with **pure HTML, CSS and JavaScript** — no frameworks, no build step, no internet needed.

## ▶ How to run

1. Unzip the folder.
2. Double-click **`index.html`** (works straight from the file system), **or** serve it locally:
   ```bash
   cd lifedrop
   python -m http.server 8000      # then open http://localhost:8000
   ```

## 📁 Project structure

```
lifedrop/
├── index.html          # Page markup (all sections)
├── css/
│   └── style.css       # Design tokens, layout, animations, dark mode, responsive rules
├── js/
│   ├── utils.js        # Helpers: DOM, storage, toast, escaping, hashing
│   ├── data.js         # Sample camps, stock, quiz, FAQs, stories (edit this to customise)
│   ├── effects.js      # Animations: reveal, counters, particles, parallax, confetti, tilt
│   └── app.js          # Features and application logic
└── README.md
```

## ✨ Features

**Visual & animation**
- Animated hero: liquid-filling blood drop (SVG waves), floating blood-cell particles on a canvas, mouse parallax, typewriter headline
- Live countdown to the next camp with flip-tick animation
- Scroll-reveal animations, animated counters, scroll-progress bar, scroll-spy navigation
- 3D card tilt, button ripples, confetti celebration
- Light / dark theme (remembers your choice, respects system preference)
- Fully responsive, keyboard accessible, honours `prefers-reduced-motion`

**Interactive tools**
- **Blood-group compatibility checker** — who can you donate to / receive from
- **Eligibility quiz** — 7 questions with progress bar and personalised result
- **Camp finder** — search, filter by city and blood group needed, sort, seat-fill bars, "Add to calendar" (`.ics` download)
- **Live blood stock dashboard** — animated blood bags with critical/low/good status, auto-updating (simulated)
- **Interactive line chart** (drawn on `<canvas>`) with hover tooltips
- **Emergency request board** — post requests, filter by group, "I can help" responses
- **Donor registration** — validation, time-slot picker with availability, duplicate prevention
- **Digital donor card** — generated on canvas, downloadable as PNG
- **Myth vs Fact** flip cards, **testimonial slider** (autoplay, swipe, dots), **FAQ accordion**
- **Organizer panel** (footer → 🔐) — view/search/delete registrations, per-group chart, **CSV export**, sample data.
  Demo PIN: **`1234`**

## 💾 Data & privacy

There is no backend. Registrations, requests and theme are saved in your browser's `localStorage`.
Camps, stock levels, requests and testimonials are **sample data** for demonstration.
Camp dates are generated relative to today, so the demo never goes out of date.

## 🛠 Customising

- Change camps, stock, quiz questions, FAQs and stories in `js/data.js`.
- Change colours in the `:root` block at the top of `css/style.css`.
- Change the organizer PIN via `ADMIN_PIN` in `js/app.js`.

## 🚀 Ideas to extend it

- Replace `localStorage` with a real backend (Node/Express, Firebase, Supabase) and send real email/SMS confirmations
- Add a map (Leaflet / Google Maps) for camp locations
- Real authentication for the organizer panel (the PIN here is a demo only and is not secure)
- Connect live stock to a blood-bank API

> ⚕️ The eligibility quiz gives general guidance only. The medical officer at the camp always makes the final decision.

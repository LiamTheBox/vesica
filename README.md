# Vesica 3D

A soft-body bladder simulator for touch screens, built with React, Three.js (React Three Fiber) and Vite.
Hold on through urges, sneezes and drinks in the arcade, play quick microgames about keeping control, or play
freely in the sandbox. It works offline once installed, and everything plays with one finger or a mouse.

Live: https://liamthebox.github.io/vesica/

## Run it on localhost

You need [Node.js](https://nodejs.org/) 22 or newer (with fnm: `fnm install 22 && fnm use 22`).

```sh
npm install     # once, and again after dependencies change
npm run dev
```

Open **http://localhost:5173**. The page reloads by itself when you save a file. Stop the server with Ctrl+C.

### On your phone

```sh
npm run dev:phone
```

This serves over HTTPS on your local network, so a phone on the same Wi-Fi can open it (phones need HTTPS for
device motion, the wake lock and installing the app). The terminal prints the address under **Network**, e.g.
`https://192.168.1.210:5173`. The certificate is self-signed, so the browser warns once: choose to continue.

### The production build

```sh
npm run build
npm run preview         # http://localhost:4173
npm run preview:phone   # build, then serve it over HTTPS on your network
```

This is what gets deployed. Only the build works offline and can be installed as an app; the dev server can't.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | Lint (Oxlint) |
| `npm run check` | Lint, unit tests and build: run before pushing |
| `npm run test:e2e` | Browser tests (Playwright); slow and heavy on the CPU |

Pushing to `main` deploys the app to GitHub Pages.

## Where things are

- `src/sim/`: the simulation (physiology, arcade rules, drinks); `src/sim/micro/`: the microgames' rules
- `src/feedback/`: what the bladder feels (`mood.js`), says (`reactions.js`) and does (`emotes.js`), what it
  notices of the camera (`camera.js`), and how events sound and buzz (`feedback.js`)
- `src/audio/`: the sound effects (`AudioManager.js`), the voice (`voice.js`) and its lines (`lines.js`)
- `src/components/3d/`: the bladder (`organGeometry.js` its shape, `organRig.js` its movement each frame,
  `bodyLanguage.js` its moves), the ureters and the stream; `src/components/micro/`: the microgames' drawing
- `src/components/ui/`: the HUD, buttons and menus
- `src/stories/`: the optional stories, one Markdown file per chapter
- `ROADMAP.md`: what's done and the open phone checks; `KNOWN_ISSUES.md`: open problems; `BACKLOG.md`:
  cleanups and additions nobody has asked for yet
- `Vesica 3D Mobile Web App.html`: the original single-file game this was ported from (open it in a browser)

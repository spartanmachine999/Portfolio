# Mohak Saxena — Portfolio

Personal portfolio. Angular 20, deployed on Vercel.

Live repo: https://github.com/spartanmachine999/Portfolio

---

## The one thing to remember

**GitHub is the real copy of this project.** The folder on your laptop is just a
working copy. If the laptop dies, is wiped, or you hand it back, nothing is lost
as long as your work is pushed.

So: after making changes you care about, always finish with a push.

```bash
git add .
git commit -m "describe what you changed"
git push
```

Pushing also triggers a fresh Vercel deploy automatically. There is no separate
deploy step and no Vercel dashboard to visit.

### Restoring it on any machine

Everything you need is these four commands. Nothing else has to be copied off
the old machine.

```bash
git clone https://github.com/spartanmachine999/Portfolio.git
cd Portfolio
npm install
npm start
```

---

## Running it locally

```bash
npm install     # once, after cloning
npm start       # dev server at http://localhost:4200 with live reload
npm run build   # production build into dist/
npm test        # unit tests
```

### If `npm` fails on Windows with a security error

PowerShell blocks `npm.ps1` by default on some machines. Two options:

- Use `npm.cmd` instead of `npm` (e.g. `npm.cmd start`), or
- Allow local scripts once, for your user only:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```

---

## Where things live

### Changing what the site says

**`src/app/services/portfolio-data.service.ts`** holds all the content — your
name, contact details, every job, every project, every skill. It is plain text
and plain lists. Editing a job description needs no Angular knowledge.

### Changing how it looks

**`src/styles.css`** is the design system. The colour palette sits at the very
top as CSS variables, so changing `--red-500` reshades the whole site.

Per-section styles live next to each section under `src/app/sections/`.

> Heads up: `angular.json` caps each component stylesheet at 4kB (warning) and
> 8kB (build failure). Shared styling belongs in `src/styles.css`, which has no
> such cap.

### Project layout

```
src/
  index.html                     page shell, meta tags, fonts
  styles.css                     design system + shared components
  app/
    services/
      portfolio-data.service.ts  ALL SITE CONTENT
      theme.service.ts           the three colour modes
      audio.service.ts           synthesized UI sounds
    directives/
      reveal.directive.ts        scroll-into-view animation
      tilt.directive.ts          card tilt + cursor spotlight
    layout/
      header/                    sticky nav, mobile drawer, scroll-spy
      footer/                    contact details, back to top
    sections/
      hero/                      intro, typewriter, avatar
      about/                     bio + quick facts
      experience/                timeline
      projects/                  project cards
      skills/                    skill groups
    features/
      starfield/                 canvas meteor shower background
      control-dock/              clock, theme, sound, game launcher
      asteroid-game/             Meteor Defense mini-game
      scroll-progress/           reading progress bar
```

---

## Features

- **Meteor shower background** on a single canvas. Meteors radiate from one
  point like a real shower, over a three-layer parallax starfield that responds
  to cursor and scroll. Pauses when the tab is hidden.
- **Three colour modes** — Inferno, Crimson, Void — all red on black. Void turns
  the meteors off, which doubles as a low-distraction / low-power mode. Choice
  is remembered.
- **Meteor Defense**, a mini-game. Keyboard or touch. High score is remembered.
  Lazy-loaded, so it costs nothing until opened.
- **Sound**, synthesized at runtime rather than shipped as audio files. Off by
  default.
- **Live clock** in the control dock.
- **Scroll-triggered reveals** throughout, plus a reading progress bar.
- **Fully responsive**, phone through desktop.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `G` | Open Meteor Defense |
| `T` | Cycle colour mode |
| `M` | Mute / unmute |
| `Esc` | Close the game |

---

## Accessibility

- Respects `prefers-reduced-motion` — animations stop, nothing is left hidden.
- Reveal animations are applied by JavaScript, so if scripts fail the content
  stays visible rather than disappearing.
- Keyboard reachable throughout, with a skip link and visible focus rings.
- Sound never autoplays.
- There is a `<noscript>` fallback carrying your contact details.

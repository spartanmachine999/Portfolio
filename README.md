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

- **Interactive background** on a single canvas: a parallax starfield, a
  constellation network that recoils from your cursor and draws lines toward it,
  a meteor shower radiating from one point like the real thing, and shockwave
  rings that shove the network when you click.
- **Six dark themes** — Inferno, Cyber, Synth, Acid, Solar, Void — each with its
  own accent, surfaces and ambient wash, not just a different highlight colour.
  Choice is remembered.
- **ASCII mode** — the background canvas re-renders itself as live character art.
- **Doodle mode** — a chalkboard skin with handwriting, hand-drawn wobbly
  borders and stick-figure doodles. All artwork original.
- **CRT power-off transition** between themes: the picture collapses to a bright
  line and powers back on in the new colour.
- **Portal hop** — warps you to a random section through a green swirl.
- **Synth pad** — nine pentatonic pads playable by click or `A`–`L`, three
  voices, each note fed through a feedback delay.
- **World clocks and live Delhi weather** in the dock, via Open-Meteo.
- **Custom 404** with a small pop-the-debris game.
- **Command palette** on `Ctrl+K`, covering navigation, themes, skins, toys and
  contact. Substring and subsequence matching.
- **Custom cursor**: a precise dot plus a targeting reticle that locks on over
  interactive elements. Mouse only; touch and reduced-motion keep the native one.
- **A hidden mini-game.** Deliberately unlabelled.
- **Cyberpunk layer**: CRT scanlines, vignette, rolling scan band, glitch text,
  animated neon card borders, perspective grid floor, marquee ticker. The Konami
  code does something.
- **Live clock**, scroll progress bar, scroll-triggered reveals, card tilt.
- **Fully responsive**, phone through desktop.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Ctrl+K` or `/` | Command palette |
| `T` | Cycle theme |
| `A` | ASCII mode |
| `D` | Doodle mode |
| `S` | Synth pad |
| `P` | Portal hop |
| `M` | UI sound on/off |
| `G` | The hidden thing |
| `Esc` | Close any overlay |
| `↑↑↓↓←→←→BA` | Something louder |

### On audio and licensing

There is deliberately **no background music**. Two reasons worth remembering
before adding any:

1. Browsers block autoplaying audio without a user gesture, so "plays on load"
   is impossible for any track, licensed or not.
2. Commercial tracks cannot be self-hosted. If you want a specific song, embed
   it (Spotify or YouTube carry the licence) or use a royalty-free track you
   have rights to. Don't drop an MP3 of a commercial release into `public/`.

The synth pad generates every sound from oscillators at runtime, so it ships no
audio files and involves no licensing.

### On the homage features

Doodle mode and Portal hop are *stylistic* nods, built entirely from original
SVG and CSS. No characters, logos, licensed fonts or artwork from any franchise
are reproduced, and the modes are named neutrally rather than after the works
they're inspired by. Keep it that way if you extend them.

## Performance notes

Worth knowing before adding more effects, because these are the things that
made it choppy the first time round:

- **One rAF loop for everything.** `RafService` owns the single
  `requestAnimationFrame` loop; the starfield, cursor and visualiser all
  subscribe to it. Do not start your own loop. It also exposes a `quality`
  signal that drops on slow devices so effects can shed particles instead of
  dropping frames.
- **Never `mix-blend-mode` on a fullscreen overlay.** It forces the whole page
  to recomposite every frame. The scanlines use plain alpha for this reason.
- **Batch canvas draws.** Stars are grouped into alpha buckets so ~300 stars
  cost ~12 draw calls rather than 300 fillStyle writes.
- **No allocation in frame callbacks.** Scratch arrays are reused; an early
  version built a 300-entry `Map` every frame.
- Offscreen sections use `content-visibility: auto`.
- Measured cost of the app's own per-frame work: about **0.45ms** of a 16.7ms
  budget.

### Gotchas

- Numeric HTML entities above `U+FFFF` get truncated to 16 bits in these
  templates — `&#128640;` produced `U+F680` (tofu) instead of the rocket. Use
  the literal character.
- Poppins has no emoji glyphs. Emoji need the `.emoji` class for its font stack.

---

## Accessibility

- Respects `prefers-reduced-motion` — animations stop, nothing is left hidden.
- Reveal animations are applied by JavaScript, so if scripts fail the content
  stays visible rather than disappearing.
- Keyboard reachable throughout, with a skip link and visible focus rings.
- Sound never autoplays.
- There is a `<noscript>` fallback carrying your contact details.

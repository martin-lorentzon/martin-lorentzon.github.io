# Pinned full-screen views (scroll-triggered stage)

A reusable pattern: one full-screen "stage" stays pinned under a sticky header while the visitor scrolls
through a stretch of page, and switches between several **views** (images and text) without the title or
the background ever leaving. Written from a working implementation; class, variable and attribute names are
illustrative (prefix `fsv-` = "full-screen views") and can be renamed freely. **Assumes Tailwind CSS v4**
(see [Adapting](#17-adapting-it) for v3 and other setups).

- [Tier 1 - Overview and tech stack](#tier-1---overview-and-tech-stack)
- [Tier 2 - Deep dive](#tier-2---deep-dive)

---

# Tier 1 - Overview and tech stack

## What it is

A section with a tall scroll "runway" containing a sticky stage. The reference configuration has **four
views**:

| # | View | What you see |
|---|------|--------------|
| 1 | Image A | Full-bleed image, untinted, title in white over a light scrim. |
| 2 | Text 1 | Image A washed out (light tint plus blur), with the first text block fading in. |
| 3 | Image B | Tinted A slides up and away like a curtain, revealing a **different, untinted** image B. |
| 4 | Text 2 | Image B washes out, and the second text block fades in. |

After view 4 the stage un-pins and the page continues with the next section.

Two kinds of motion are combined on purpose:

- **Timed fades (450 ms).** Tints, text blocks and the title/arrow colour flips. They fire when scroll crosses
  a *trigger point* and then play on their own clock, so the page never rests halfway through a fade.
- **One scrubbed motion.** Image A's slide follows the scrollbar 1:1 ("scrolled into view", not faded).

An optional bouncing chevron at the bottom of the stage steps to the next view on each click, then leaves the
section from the last view.

## Why it works this way

- Scroll *stays natural*: no scroll-jacking, no snap CSS, no wheel listeners. The stage is just
  `position: sticky` inside a tall runway element.
- Text stays readable without a card behind it because the image is washed to ~90% of a tint colour with
  `backdrop-blur`, and the text uses full-contrast ink.
- It works in every modern browser. CSS scroll-driven animations (`animation-timeline`) were tried first and
  dropped because Firefox does not ship them by default; a ~70-line script is the single code path.
- With reduced motion, or without JS, the section is a plain stacked layout (banner image, title, all text
  blocks), so nothing is hidden.

## Tech stack

| Piece | Used for |
|-------|----------|
| HTML | Section markup and the tuning numbers (`data-zone-*` attributes). |
| **Tailwind CSS v4** | Component classes in `@layer components`, `@apply` for plain utilities, theme via CSS variables. |
| Vanilla JS (one classic script) | Scroll progress -> CSS custom properties, state machine, arrow stepping. No dependencies. |
| CSS `position: sticky`, `svh` / `lvh` units | Pinning and mobile-toolbar-safe sizing. |
| CSS `@property` (registered custom properties) | Lets a `transition` animate variables that drive opacity and colour. |
| CSS `color-mix()`, `clamp()`, `calc()`, `min()` | Derived opacities and the colour blend. |
| Any icon set (or inline SVG) | The arrow's chevron. |

## Files

| File | Role |
|------|------|
| Page/markup file | The `<section class="fsv">` block and its `data-zone-*` tuning attributes. |
| `fsv.js` | Behaviour: zone maths, progress variable, state attribute, arrow click, enabling transitions. |
| Your Tailwind entry CSS | The `.fsv*` component classes plus four `@property` rules. **Rebuild after editing.** |

## Prerequisites

- A build step that compiles Tailwind v4 (`@import "tailwindcss";`).
- A CSS variable `--header-h` equal to the rendered height of your sticky header (`0px` if there is none).
- The runway's ancestors must **not** set `overflow: hidden/auto/scroll` (it breaks `position: sticky`).

## Tuning (the only numbers you normally touch)

On the `<section>` tag, in **svh of scroll distance** (1 svh = 1% of the viewport height):

```html
<section class="fsv scroll-mt-(--header-h)"
         data-zone-image="35" data-zone-text="45" data-zone-slide="75">
```

| Attribute | Meaning | Default |
|-----------|---------|---------|
| `data-zone-image` | Scroll length of each untinted view (A, then B). | 35 |
| `data-zone-text` | Scroll length of each text view (Text 1, then Text 2). | 45 |
| `data-zone-slide` | Scroll length of A's slide (bigger = slower, smoother). | 75 |
| `data-zone-slide-delay` *(optional)* | Extra tinted-A pause with no text before the slide, so the text finishes fading out first. | 10 (used when the attribute is absent) |

Order of zones: image, text, slide-delay, slide, image, text. Editing an attribute needs only a browser
refresh (no CSS rebuild). The fade duration (450 ms) lives in the CSS and does need a rebuild.

---

# Tier 2 - Deep dive

## 1. Architecture in one picture

```
<section class="fsv">                    height = zone-total + 100svh - header   (the "runway")
  <div class="fsv-stage">                position: sticky; top: header; height: 100svh - header
    layer-b  (bottom)  image B + scrim + wash
    layer-a  (above B) image A + scrim + wash      <- translateY(-slide * 100%)
    content  (above)   title + text panels (absolute, stacked)
    a.fsv-next         bottom-centre chevron
  </div>
</section>
```

Scrolling through the runway moves the sticky stage's *position within the runway*, which the script turns
into a number `--fsv-p` from 0 to 1. Everything else is derived from `--fsv-p` (scrubbed) or from a discrete
`data-state` attribute (timed).

```
scroll --> --fsv-p (0..1) --+--> --fsv-slide --> translateY of layer A, title/arrow flip   (scrubbed)
                            |
                            +--> data-state 0..3 --> CSS sets --fsv-tint-a / -text-1 / -tint-b / -text-2
                                                     --> @property + transition 450ms --> opacity, colour  (timed)
```

## 2. Markup contract

Class names and structure the CSS and script rely on. Order in the DOM = paint order, so no `z-index` is
needed except on the arrow:

```html
<section class="fsv scroll-mt-(--header-h)"
         data-zone-image="35" data-zone-text="45" data-zone-slide="75">
  <div class="fsv-stage">
    <div class="fsv-layer fsv-layer-b" aria-hidden="true">
      <img src="image-b.jpg" alt="" class="fsv-media" />
      <div class="fsv-scrim"></div>
      <div class="fsv-wash"></div>
    </div>
    <div class="fsv-layer fsv-layer-a">
      <img src="image-a.jpg" alt="" class="fsv-media" />
      <div class="fsv-scrim" aria-hidden="true"></div>
      <div class="fsv-wash" aria-hidden="true"></div>
    </div>
    <div class="fsv-content">
      <h2 class="fsv-title text-4xl font-semibold">Section title</h2>
      <div class="fsv-texts">
        <div class="fsv-panel fsv-panel-1 space-y-4"><h3>First heading</h3><p>First text...</p></div>
        <div class="fsv-panel fsv-panel-2 space-y-4"><h3>Second heading</h3><p>Second text...</p></div>
      </div>
    </div>
    <a href="#next-section" class="fsv-next" aria-label="Scroll on" data-fsv-next>
      <svg class="size-6 motion-safe:animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </a>
  </div>
</section>
```

Notes:

- **B comes before A in the DOM** so A paints over B without z-index. A is the layer that slides away.
- Give the section its **own `scroll-mt-(--header-h)`** so in-page links to it land with the stage already
  pinned at view 1.
- Keep the text panels **short** (they share one screen with the title), and don't put them in `overflow`
  containers. Both panels stay in the DOM at all times (opacity only), so they remain in reading order for
  assistive tech and in the no-JS fallback.
- The arrow is a real link to whatever follows the section. That is the no-JS/last-view behaviour; the script
  intercepts it only while there is a next view. Omit the arrow entirely if you don't want it (the script
  guards with `?.`).
- Text colour utilities on titles/text are not needed for the pinned states: `.fsv-title` gets its colour from
  the blend in section 8. Body text inside panels should use your normal full-contrast colour (`--fsv-ink`).

## 3. Geometry and units

- `--header-h` (`:root`) must equal the rendered height of the sticky header. The stage sticks at
  `top: var(--header-h)`.
- **Stage height uses `svh`**: `calc(100svh - var(--header-h))`. `svh` is the *small* viewport (mobile toolbar
  shown), so when a browser hides its URL bar while scrolling the stage does **not** resize/jump.
- **Image, scrim and wash layers use `lvh`**: `calc(100lvh - var(--header-h))`. They are taller than the
  stage, so when the toolbar collapses no bare strip appears under the stage. The stage uses
  `overflow-x: clip` only, so the extra height can overflow vertically.
- **Runway height** = `var(--fsv-zone-total) + 100svh - var(--header-h)`. The sticky stage travels exactly
  `zone-total` svh inside it, which is what makes zone lengths literal scroll distances.
- The pinned section gets a bottom margin (`mb-14 sm:mb-20` in the reference) so there is breathing room
  before the next section.

## 4. Zones and progress (`fsv.js`)

The knobs are read with `getAttribute("data-zone-<name>")` (see *Gotchas*). A missing or
non-numeric attribute falls back to the knob's default (0, except `slide-delay`, which is 10); negatives
are clamped to 0.

Zones in scroll order (`image` and `text` each appear twice):

```
image-a | text-1 | slide-delay | slide | image-b | text-2
```

- `total` = sum of all zones (fallback 1 to avoid divide-by-zero).
- Each zone's `start`/`end` is stored as a **fraction of `total`** (0..1).
- The script writes on the section: `--fsv-zone-total: <total>svh`, `--fsv-slide-start`, `--fsv-slide-len`
  (min 0.0001).

Progress calculation (runs in `requestAnimationFrame`, coalesced by a `queued` flag on `scroll`/`resize`):

```
pinnedTop = parseFloat(getComputedStyle(stage).top)          // header height in px
range     = section.offsetHeight - stage.offsetHeight        // == zone-total in px
p         = clamp((pinnedTop - section.getBoundingClientRect().top) / range, 0, 1)
```

`p = 0` when the section top reaches the header's bottom edge; `p = 1` when the runway's bottom leaves the
stage. `--fsv-p` is written with 4 decimals.

### Default numbers (35 / 45 / 75, delay 10, total 245svh)

| Zone | svh | `--fsv-p` range |
|------|-----|-----------------|
| image-a | 35 | 0 - 0.143 |
| text-1 | 45 | 0.143 - 0.327 |
| slide-delay | 10 | 0.327 - 0.367 |
| slide | 75 | 0.367 - 0.673 |
| image-b | 35 | 0.673 - 0.816 |
| text-2 | 45 | 0.816 - 1 |

Runway height = 245svh + 100svh - header height.

## 5. State machine (timed fades)

Three triggers, in `--fsv-p`: `end of image-a`, `end of text-1`, `end of image-b`.

```js
const triggers = [zone["image-a"].end, zone["text-1"].end, zone["image-b"].end];
const hysteresis = 0.01;
const stateFor = (progress) => {
  while (state < triggers.length && progress >= triggers[state]) state++;
  while (state > 0 && progress < triggers[state - 1] - hysteresis) state--;
  return state;
};
```

- The state moves **one step at a time** in a loop, and stepping down needs `progress` to drop `hysteresis`
  (0.01 of total) *below* the trigger, so hovering on a boundary cannot flicker.
- `update()` writes `section.dataset.state = state` (0..3).

| `data-state` | Meaning | Registered vars set by CSS |
|--------------|---------|----------------------------|
| 0 | Image A untinted | (none: all four fall back to `initial-value: 0`) |
| 1 | A tinted + Text 1 | `--fsv-tint-a: 1; --fsv-text-1: 1` |
| 2 | Text 1 gone, A tinted (covers slide-delay, the slide, and image B untinted) | `--fsv-tint-a: 1` |
| 3 | B tinted + Text 2 | `--fsv-tint-a: 1; --fsv-tint-b: 1; --fsv-text-2: 1` |

`--fsv-tint-a` stays 1 in states 2 and 3 on purpose: A is off-screen by then, and if the user scrolls back
it must still be tinted when it slides down again.

## 6. Timed transitions with registered properties

Four top-level rules (NOT inside `@layer`), each `syntax: "<number>"; inherits: true; initial-value: 0`:
`--fsv-tint-a`, `--fsv-text-1`, `--fsv-tint-b`, `--fsv-text-2`.

```css
.fsv-animated {
  transition: --fsv-tint-a 450ms ease-out, --fsv-text-1 450ms ease-out,
              --fsv-tint-b 450ms ease-out, --fsv-text-2 450ms ease-out;
}
```

Registering the properties is what makes them animatable; unregistered custom properties change instantly.
`inherits: true` lets descendants read them. Consumers:

| Element | Rule |
|---------|------|
| Layer A scrim | `opacity: calc(1 - var(--fsv-tint-a))` |
| Layer A wash | `opacity: var(--fsv-tint-a)` |
| Layer B scrim | `opacity: calc(1 - var(--fsv-tint-b))` |
| Layer B wash | `opacity: var(--fsv-tint-b)` |
| Text 1 panel | `opacity: var(--fsv-text-1)` |
| Text 2 panel | `opacity: var(--fsv-text-2)` |
| Title / arrow colour | see section 8 |

`.fsv-animated` is added by the script **two animation frames after the first `update()`**, so a page loaded
mid-section (reload, anchor jump) snaps to its state instead of fading in from state 0.

## 7. The scrubbed slide

```css
.fsv-pinned {
  --fsv-slide: clamp(0, calc((var(--fsv-p) - var(--fsv-slide-start)) / var(--fsv-slide-len)), 1);
}
.fsv-pinned .fsv-layer-a {
  transform: translateY(calc(var(--fsv-slide) * -100%));   /* -100% of its own height (lvh - header) */
  will-change: transform;
}
```

`--fsv-slide` is 0..1 across the slide zone only (clamped), so before it starts A is in place and after it
ends A is fully above the stage. (A sticky header with a higher `z-index` hides the sliver that overlaps the
header band.) The tinted wash travels with A because the wash is a child of layer A.

## 8. Title and arrow colour

Both blend between **white** (over an untinted image) and the ink colour (over a tint). The "whiteness"
share is:

```
white = min(1, (1 - tint-a) + flip * (1 - tint-b))
```

`min(1, ...)` is required: a `color-mix()` percentage above 100% is invalid and would silently drop the whole
declaration during a fast scroll when the sum briefly exceeds 1.

| Element | `flip` | Why |
|---------|--------|-----|
| Title (`.fsv-title`) | `--fsv-title-flip = clamp((slide - 0.7) / 0.2, 0, 1)` | The title is at the *top*; B only reaches it when A's bottom edge passes it, late in the slide. Colour = `color-mix(in oklab, white W%, var(--fsv-ink))`. |
| Arrow (`.fsv-next`) | `--fsv-next-flip = clamp(slide / 0.1, 0, 1)` | The arrow is at the *bottom*; B shows there as soon as the slide begins. Colour mixes white with `color-mix(in oklab, var(--fsv-ink) 50%, transparent)`. |

Scenario check: view 1 (`tint-a = 0`) -> white; view 2 (`tint-a = 1`, `flip = 0`) -> ink; end of slide
(`flip = 1`, `tint-b = 0`) -> white again; view 4 (`tint-b = 1`) -> ink.

The 0.7 / 0.2 and 0.1 constants depend on where the title and arrow sit vertically in the stage; retune them
if you move those elements.

## 9. Readability layers

- **Wash** (`.fsv-wash`): a `--fsv-tint` colour at 90% opacity plus `backdrop-blur-md`. The blur stops image
  detail competing with text. Set `--fsv-tint` to your page background so it flips correctly in dark mode.
- **Scrim** (`.fsv-scrim`): `@apply bg-linear-to-b from-black/60 via-transparent to-black/40`. Only visible
  while the image is untinted (opacity `1 - tint`); it protects the white title (top) and white arrow
  (bottom) over bright photos. Reduce the stops if untinted images look too dark.
- Avoid drop shadows on the text: the wash and scrim do that job.

## 10. The arrow (`[data-fsv-next]`)

Views the arrow steps through are the **middle of each hold zone**:

```js
const holds = ["text-1", "image-b", "text-2"].map((n) => (zone[n].start + zone[n].end) / 2);
```

On click: find the first hold `> currentP + 0.02`. If there is one, `preventDefault()` and smooth-scroll to it:

```js
scrollTo({ top: sectionTop - pinnedTop + next * range, behavior: "smooth" });
// sectionTop = section.getBoundingClientRect().top + scrollY
```

If none is left, the click is not prevented and the `href` scrolls on to the next section. (Defaults: stops at
p ~ 0.235, 0.745, 0.908.) Because the smooth scroll passes through zones, the fades on the way still fire.

## 11. Fallback layout (default styles, no `.fsv-pinned`)

The unpinned CSS is the fallback and is also what non-JS and reduced-motion visitors get (the script returns
before adding `.fsv-pinned` when `matchMedia("(prefers-reduced-motion: reduce)")` matches):

- `.fsv-media`: `block h-56 w-full object-cover sm:h-80` (image A as a banner).
- `.fsv-layer-b`, `.fsv-scrim`, `.fsv-wash`, `.fsv-next`: `hidden`.
- `.fsv-content`: `mx-auto max-w-5xl px-4 py-14 sm:px-12 sm:py-20` (match your site's section container).
- `.fsv-texts`: `mt-8 grid gap-8` (all panels stacked, fully visible).

Pinned mode overrides these with higher-specificity selectors (`.fsv-pinned .x`), so the two layouts never
need `!important`.

## 12. Full CSS (reference)

In your Tailwind entry file. Everything lives in `@layer components` except `:root` variables and the
`@property` rules.

```css
@import "tailwindcss";

:root {
  --header-h: 4.5rem;   /* rendered height of your sticky header; 0px if none */
  --fsv-tint: #fff;     /* wash colour: normally the page background */
  --fsv-ink: #111;      /* title / text / arrow colour over the wash */
}
@media (prefers-color-scheme: dark) {   /* or your own theme selector, e.g. [data-theme="dark"] */
  :root { --fsv-tint: #000; --fsv-ink: #f5f5f5; }
}

@layer components {
  /* --- fallback (default) layout --- */
  .fsv-media { @apply block h-56 w-full object-cover sm:h-80; }
  .fsv-layer-b, .fsv-scrim, .fsv-wash, .fsv-next { @apply hidden; }
  .fsv-content { @apply mx-auto max-w-5xl px-4 py-14 sm:px-12 sm:py-20; }
  .fsv-texts { @apply mt-8 grid gap-8; }

  /* --- pinned mode (class added by fsv.js unless reduced motion) --- */
  .fsv-pinned {
    @apply mb-14 sm:mb-20;
    height: calc(var(--fsv-zone-total, 250svh) + 100svh - var(--header-h));
    --fsv-p: 0;
    --fsv-slide-start: 0.5;          /* fallbacks; the script always overwrites these */
    --fsv-slide-len: 0.3;
    --fsv-slide: clamp(0, calc((var(--fsv-p) - var(--fsv-slide-start)) / var(--fsv-slide-len)), 1);
    --fsv-title-flip: clamp(0, calc((var(--fsv-slide) - 0.7) / 0.2), 1);
    --fsv-next-flip: clamp(0, calc(var(--fsv-slide) / 0.1), 1);
  }
  .fsv-animated {
    transition: --fsv-tint-a 450ms ease-out, --fsv-text-1 450ms ease-out,
                --fsv-tint-b 450ms ease-out, --fsv-text-2 450ms ease-out;
  }
  .fsv-pinned[data-state="1"] { --fsv-tint-a: 1; --fsv-text-1: 1; }
  .fsv-pinned[data-state="2"] { --fsv-tint-a: 1; }
  .fsv-pinned[data-state="3"] { --fsv-tint-a: 1; --fsv-tint-b: 1; --fsv-text-2: 1; }

  .fsv-pinned .fsv-stage {
    position: sticky; top: var(--header-h);
    height: calc(100svh - var(--header-h)); overflow-x: clip;
  }
  .fsv-pinned .fsv-layer {
    position: absolute; inset-inline: 0; top: 0; display: block;
    height: calc(100lvh - var(--header-h));
  }
  .fsv-pinned .fsv-layer-a { transform: translateY(calc(var(--fsv-slide) * -100%)); will-change: transform; }
  .fsv-pinned .fsv-media,
  .fsv-pinned .fsv-scrim,
  .fsv-pinned .fsv-wash { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  .fsv-pinned .fsv-scrim { @apply bg-linear-to-b from-black/60 via-transparent to-black/40; }
  .fsv-pinned .fsv-wash {
    @apply backdrop-blur-md;
    background: color-mix(in oklab, var(--fsv-tint) 90%, transparent);
  }
  .fsv-pinned .fsv-layer-a .fsv-scrim { opacity: calc(1 - var(--fsv-tint-a)); }
  .fsv-pinned .fsv-layer-a .fsv-wash  { opacity: var(--fsv-tint-a); }
  .fsv-pinned .fsv-layer-b .fsv-scrim { opacity: calc(1 - var(--fsv-tint-b)); }
  .fsv-pinned .fsv-layer-b .fsv-wash  { opacity: var(--fsv-tint-b); }
  .fsv-pinned .fsv-content {
    position: relative; display: flex; height: 100%; flex-direction: column; padding-block: 1.5rem;
    color: var(--fsv-ink);
  }
  .fsv-pinned .fsv-next {
    position: absolute; bottom: 1.5rem; left: 50%; z-index: 10; display: block; translate: -50% 0;
    color: color-mix(in oklab, white calc(min(1, 1 - var(--fsv-tint-a) + var(--fsv-next-flip) * (1 - var(--fsv-tint-b))) * 100%),
                     color-mix(in oklab, var(--fsv-ink) 50%, transparent));
  }
  .fsv-pinned .fsv-title {
    color: color-mix(in oklab, white calc(min(1, 1 - var(--fsv-tint-a) + var(--fsv-title-flip) * (1 - var(--fsv-tint-b))) * 100%),
                     var(--fsv-ink));
  }
  .fsv-pinned .fsv-texts { position: relative; display: block; flex: 1; }
  .fsv-pinned .fsv-panel { position: absolute; inset-inline: 0; top: 0; }
  .fsv-pinned .fsv-panel-1 { opacity: var(--fsv-text-1); }
  .fsv-pinned .fsv-panel-2 { opacity: var(--fsv-text-2); }
}

/* top level, outside any @layer, one per var: */
@property --fsv-tint-a { syntax: "<number>"; inherits: true; initial-value: 0; }
@property --fsv-text-1 { syntax: "<number>"; inherits: true; initial-value: 0; }
@property --fsv-tint-b { syntax: "<number>"; inherits: true; initial-value: 0; }
@property --fsv-text-2 { syntax: "<number>"; inherits: true; initial-value: 0; }
```

## 13. Full script (reference) - `fsv.js`

Load as a classic script after the markup (end of `<body>`, or `defer`). It does not wait for
`DOMContentLoaded`. It sets up **every** `.fsv` element on the page independently (see [Adapting](#17-adapting-it)).

```js
// Pinned full-screen views. For each .fsv section: writes scroll progress
// through the pinned stretch as --fsv-p (0-1), which scrubs the slide of image A, and data-state (0-3)
// at the scroll points below, which triggers the timed fades. Both are consumed in src/input.css
// (.fsv-pinned). Skipped for reduced motion, which keeps the plain stacked layout.
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".fsv").forEach(init);
}

function init(section) {
  const stage = section.querySelector(".fsv-stage");
  if (!stage) return;
  section.classList.add("fsv-pinned");

  // Tuning knobs: data-zone-* on the section, in svh of scroll distance.
  //   image        each untinted view (A, then B)
  //   text         each text view (first, then second)
  //   slide-delay  tinted A with no text before the slide starts, so the text has faded out first (default 10)
  //   slide        A sliding up and away (scrubbed; the only zone that follows the scroll 1:1)
  // Scroll order: image A, text 1, slide-delay, slide, image B, text 2. Everything below (runway
  // height, --fsv-p scroll points, slide range, arrow stops) derives from that.
  const knob = (name, fallback = 0) => {
    const value = parseFloat(section.getAttribute(`data-zone-${name}`));
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  };
  const image = knob("image");
  const text = knob("text");
  const zoneNames = ["image-a", "text-1", "slide-delay", "slide", "image-b", "text-2"];
  const zones = [image, text, knob("slide-delay", 10), knob("slide"), image, text];
  const total = zones.reduce((sum, zone) => sum + zone, 0) || 1;
  const ends = zones.map((_, i) => zones.slice(0, i + 1).reduce((sum, zone) => sum + zone, 0) / total);
  const starts = [0, ...ends.slice(0, -1)];
  const zone = Object.fromEntries(zoneNames.map((name, i) => [name, { start: starts[i], end: ends[i] }]));

  section.style.setProperty("--fsv-zone-total", `${total}svh`);
  section.style.setProperty("--fsv-slide-start", zone.slide.start.toFixed(4));
  section.style.setProperty("--fsv-slide-len", Math.max(zone.slide.end - zone.slide.start, 0.0001).toFixed(4));

  // --fsv-p at which the state steps up: tint A + text 1 in, text 1 out, tint B + text 2 in.
  const triggers = [zone["image-a"].end, zone["text-1"].end, zone["image-b"].end];
  const hysteresis = 0.01;
  let state = 0;
  const stateFor = (progress) => {
    while (state < triggers.length && progress >= triggers[state]) state++;
    while (state > 0 && progress < triggers[state - 1] - hysteresis) state--;
    return state;
  };

  let queued = false;
  const update = () => {
    queued = false;
    const pinnedTop = parseFloat(getComputedStyle(stage).top);
    const range = section.offsetHeight - stage.offsetHeight;
    const progress = Math.min(1, Math.max(0, (pinnedTop - section.getBoundingClientRect().top) / range));
    section.style.setProperty("--fsv-p", progress.toFixed(4));
    section.dataset.state = stateFor(progress);
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };

  // Views the arrow steps through: the middle of each hold zone. Past the last one it follows its href
  // to the next section.
  const holds = ["text-1", "image-b", "text-2"].map((name) => (zone[name].start + zone[name].end) / 2);
  section.querySelector("[data-fsv-next]")?.addEventListener("click", (event) => {
    const range = section.offsetHeight - stage.offsetHeight;
    const progress = parseFloat(section.style.getPropertyValue("--fsv-p")) || 0;
    const next = holds.find((hold) => hold > progress + 0.02);
    if (next === undefined) return;
    event.preventDefault();
    const pinnedTop = parseFloat(getComputedStyle(stage).top);
    const sectionTop = section.getBoundingClientRect().top + scrollY;
    scrollTo({ top: sectionTop - pinnedTop + next * range, behavior: "smooth" });
  });

  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  update();
  // Enable the fade transitions only after the first state is applied, so a reload mid-section
  // doesn't animate in from state 0.
  requestAnimationFrame(() => requestAnimationFrame(() => section.classList.add("fsv-animated")));
}
```

## 14. Recreating it from scratch (checklist)

1. Define `--header-h`, `--fsv-tint`, `--fsv-ink` in `:root` (section 12). Make your header `sticky top-0`
   with a `z-index` above the section (or set `--header-h: 0px` if there is none).
2. Add the section markup (section 2) with two images and your two text blocks.
3. Write the **fallback** styles first (section 11) and confirm the stacked layout looks right.
4. Add the four `@property` rules (top level) and the `.fsv-pinned` block (section 12).
5. Add `fsv.js` and its script tag; set `data-zone-*` on the section.
6. Rebuild the Tailwind CSS, hard-refresh, then verify (below).

## 15. Verifying

Jump to a scroll position by `--fsv-p` in the browser console (works at any viewport size):

```js
const s = document.querySelector(".fsv");
const stage = s.querySelector(".fsv-stage");
const header = parseFloat(getComputedStyle(stage).top);        // header height in px
const top = s.getBoundingClientRect().top + scrollY;
const goTo = (p) => scrollTo(0, top - header + p * (s.offsetHeight - stage.offsetHeight));
goTo(0.5); // then read s.dataset.state, s.style.getPropertyValue("--fsv-p"),
           // getComputedStyle(s).getPropertyValue("--fsv-tint-a")
```

Check at ~375x667 and ~1280x800, in light and dark themes, and confirm: states step at the trigger fractions
in section 4; the title/arrow colours match section 8; each text panel fits under the title on the shortest
phone viewport; reduced motion shows the stacked layout.

## 16. Gotchas and design decisions

- **Firefox has no `animation-timeline`.** A first version used CSS scroll-driven animations and showed the
  fallback in Firefox-based browsers. The script-written `--fsv-p` path replaced it entirely.
- **`@property` must be top-level.** Do not nest it in `@layer`. Without registration the variables change
  instantly and nothing fades.
- **`color-mix()` percentages > 100% are invalid**, hence `min(1, ...)` in the colour formula.
- **Data attributes with a digit after a hyphen** (e.g. `data-zone-text-1`) do not map cleanly onto
  `dataset` (it stays `zoneText-1`). That is why the script reads `getAttribute`.
- **Tailwind only compiles what it sees.** New utilities in `@apply` need a rebuild; the `data-zone-*`
  numbers do not.
- **Sticky needs overflow-free ancestors.** Only `overflow-x: clip` on the stage itself is safe.
- **Transitions are main-thread** (animated custom properties, plus a `backdrop-filter`). If a low-end phone
  stutters, replace `backdrop-blur-md` on the wash with a static blur layer that only fades in.
- **Overlap with the slide.** `slide-delay` (default 10 svh) gives the 450 ms text fade-out time to finish
  before the slide starts. At 0 the fade overlaps the first moments of the slide; a hard flick can still
  outrun it. It is 10 svh of scroll where nothing but the tinted image shows, so lower it (6-8) if that
  feels like dead scroll.
- **Deliberately not done:** scroll snap (fights fast flicks, affects the whole page), wheel/touch hijacking,
  scrubbed fades (users could rest halfway), a card behind the text.
- **Images:** use assets at least viewport-sized, `object-cover`; test the wash and scrim with bright photos.

## 17. Adapting it

- **No sticky header:** set `--header-h: 0px`. Remove the header mentions from your own notes.
- **Theme / dark mode:** only `--fsv-tint` and `--fsv-ink` need to change per theme (a class, a
  `[data-theme]` selector, or `@media (prefers-color-scheme)`).
- **Different content sizes:** the stage is one screen tall minus the header, so each text panel plus the
  title must fit that. Long text is the main failure mode; split it into another view instead of shrinking it.
- **More or fewer views:** every *timed* element is a registered variable plus a `data-state` rule; every
  zone is an entry in `zoneNames` / `zones`. To add a view, add its zone(s), a trigger, a state value, a
  variable (and its `@property` + transition entry) and the panel/layer that consumes it. To drop the slide
  (crossfade instead), remove `.fsv-layer-a`'s transform and drive its wash/scrim from a timed variable only.
- **Frameworks (React/Vue/Svelte/...):** render the same markup as a component and run the script body once
  after mount (with cleanup: remove the `scroll`/`resize` listeners). No framework state is needed; the
  script writes attributes and CSS variables directly. Under SSR nothing runs on the server and the
  fallback layout renders until hydration.
- **Multiple instances:** already supported. The script runs `init(section)` for every `.fsv`, and the CSS
  scopes all variables to `.fsv-pinned`, so a second section only needs its own markup (and its own
  `data-zone-*` numbers). Each instance still needs exactly two image layers and two text panels.
- **Tailwind v3:** replace `bg-linear-to-b` with `bg-gradient-to-b`; `scroll-mt-(--header-h)` becomes
  `scroll-mt-[var(--header-h)]`; put the `@property` rules and the `:root` variables in a plain CSS file (or
  the base layer's sibling) since v3 has no `@import "tailwindcss"` entry; everything else is plain CSS.
- **No Tailwind at all:** every `@apply` line is a handful of plain declarations (`display: none`,
  `object-fit: cover`, `backdrop-filter: blur(12px)`, a `linear-gradient(...)`, margins/paddings); nothing
  else depends on Tailwind.

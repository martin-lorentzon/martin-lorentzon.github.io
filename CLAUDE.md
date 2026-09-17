# Project conventions

- Avoid shadows. Don't add `shadow-*` utilities, and where a daisyUI component still shows a shadow by default, apply `shadow-none` to remove it.
- Only remove a shadow on an element you're actively changing as part of the current task. Don't strip shadows from unrelated elements you happen to touch or pass through — a shadow outside the current task's scope was added intentionally and should be left alone unless the user asks about it.
- Prefer daisyUI's own component classes (e.g. `btn`, `card`, `input`) over building the same thing from raw Tailwind utilities. Fall back to plain Tailwind only for layout/spacing or when daisyUI has no matching component.
- Escape `&` as `&amp;` in HTML text content (headings, copy, etc.) — don't leave bare ampersands.
- When adapting pasted/legacy copy, fix obvious typos and spelling errors silently rather than preserving them verbatim. Only flag a change if the intended wording is ambiguous.
- This site's icon system is lucide (`<i data-lucide="...">` + `vendor/lucide.min.js`). When adapting legacy markup that references a different icon set (e.g. Material Symbols), convert it to the closest lucide equivalent rather than mixing icon libraries.
- Every icon on the site must come from lucide — never hand-write or paste a raw `<svg>`/`<path>` icon, even for framework widgets like daisyUI's theme swap. Use `<i data-lucide="...">` and let `lucide.createIcons()` render it; if you need a component's structural classes (e.g. `swap-off`/`swap-on`) on the icon, put them on the `<i>` — they carry over to the rendered `<svg>`.
- Gradient text colors (`bg-gradient-to-r from-* to-*`) are picked per section to fit that section's content — there's no fixed palette to cycle through. Just avoid repeating the same gradient in adjacent sections.
- Avoid awkward line breaks in headings and short text, especially on mobile widths (~360-400px):
  - When a heading ends with a trailing icon (`<i data-lucide="...">`), don't lay it out as a separate flex item alongside the text (`flex flex-wrap items-center gap-3`) — on narrow screens the icon gets orphaned onto its own line below the wrapped text. Instead wrap the icon and the word it follows together in `<span class="whitespace-nowrap">last-word<i ...></i></span>` (`ml-2`/`ml-3` on the icon for spacing) so it always travels with that word.
  - For a hyphenated compound that should read as one unit (e.g. "in-house-verktyg", "e-post"), use a non-breaking hyphen (`&#8209;`) instead of a plain `-`. It renders identically but stops the browser from splitting the word at the hyphen, so a wrap moves the whole compound to the next line instead of stranding a fragment like "in-" or "e-".
  - For long unbreakable strings like an email address, don't rely on `break-words`/`overflow-wrap` alone — it can strand a single character (e.g. a lone "e" off "martinlorentzon.se"). Add explicit `<wbr />` at natural boundaries instead (e.g. `contact@<wbr />martinlorentzon<wbr />.se`).
  - This is a static-build project (`npm run build`, Tailwind CLI → `dist/output.css`) — after adding a Tailwind class that isn't already used elsewhere in the file, rebuild before checking in the browser, or the new class won't be in the compiled CSS and will silently have no effect.
- Mark every top-level structural region of `index.html` with a 3-line boxed banner comment, and add one whenever a new top-level region is introduced (don't wait to be asked):
  ```
  <!-- ================================================================== -->
  <!-- SECTION NAME                                                      -->
  <!-- ================================================================== -->
  ```
  - "Top-level" means: header/navbar, each `<section id="...">` in `<main>`, footer, the mobile drawer menu, and the scripts block at the end of `<body>` — not nested subsections within them (e.g. the FAQ accordion or footer link columns don't get their own banner).
  - Match the indentation of the element the banner precedes; size the `=` dashes so the banner reads as a clean box at that indent level (see existing banners in `index.html` for the pattern).
  - Name the section in caps, using the element's `id` or a short plain-English label (e.g. `HERO`, `KONTAKT`, `MOBILE MENU (drawer side)`).

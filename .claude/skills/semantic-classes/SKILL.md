---
name: semantic-classes
description: Keep semantic classes in src/input.css consistent when editing index.html. Use whenever adding or changing markup, when the same utility group appears on multiple elements, or when a raw utility duplicates an existing class.
---

# Semantic classes

Read the `@layer components` block in `src/input.css` first. **Reuse an existing class before inventing one**, and make any new class fit the existing vocabulary. Only *suggest* new extractions in one line (e.g. "`text-2xl font-semibold` is on several `h3`s, want a `subtitle` class?"); don't refactor unasked. Do swap in existing classes when you're already editing the element.

## The vocabulary
- **Layout/type families:** `page-section`, `section-title` (+ `section-title-icon`), `subtitle`, `copy-body` / `copy-punchy` (+ `copy-inline-icon`), `link-list`. New classes join a family (`copy-*`, `section-*`) or get a role name, never an appearance name.
- **Color is separate from size.** Compose a size class with a color token: `copy-punchy text-dimmed`, `copy-body text-muted`. Tokens: `text-muted` (80%), `text-dimmed` (60%), `text-emphasis` (full, for highlights inside dimmed text). Never write raw `text-base-content/60|80` or `text-base-content` in markup; use the token. Size/weight classes (`subtitle`, `copy-*`) never bake in a color.
- **Shared numbers are CSS variables** in `:root` (`--navbar-h`), not repeated magic values.

## Rules
1. Extract when the same utility group repeats or you're about to copy it. Not for one-offs. Single-utility classes are fine only as color tokens.
2. `@apply` **plain Tailwind utilities only**, never a daisyUI component (`collapse`, `join-item`, `menu`...); keep those literal in the HTML.
3. Put `copy-*` and color tokens on the element that holds the text (`<p>`, `<ul>`), never on a wrapper div; the wrapper carries only layout (`<div class="mt-8 space-y-5"><p class="copy-punchy text-dimmed">`). Context-dependent spacing (`mt-*`, `space-y-*`, `pt-*`) and one-off tweaks stay inline on the element. So do per-use icon nudges that differ (`section-title-icon -translate-y-1`); a nudge identical on every use belongs in the class (`copy-inline-icon`). Pure layout stays inline unless it repeats identically as a named pattern (`link-list`).
4. Utilities beat components, so inline overrides work (`subtitle text-xl`).
5. After changes run `npm run build`, then check ~375px and ~1280px look unchanged (`sm:` variants are the usual casualty).

---
name: semantic-classes
description: Suggest turning repeated Tailwind utility groups into semantic classes in src/input.css. Use whenever editing index.html and the same group of utilities appears together on multiple elements (or you're about to paste an existing utility string onto another element).
---

# Semantic classes

When you notice a repeated utility group, **suggest** extracting it in one line, e.g. "`text-2xl font-semibold text-base-content` is on several `h3`s, want a `subtitle` class?". Don't refactor unasked.

## When to suggest
- Same group of utilities on multiple elements, or you're about to copy one onto a new element.
- Not for one-offs, single utilities, or pure layout (`flex`, `gap`, `grid`, `mt-*`); those stay inline.

## How
1. Add the class to `@layer components` in `src/input.css`, named by role (`page-section`, `copy-punchy`), not appearance.
2. `@apply` **plain Tailwind utilities only**. Never `@apply` a daisyUI component (`collapse`, `join-item`, `menu`...); its parent/child selectors don't survive. Keep daisyUI classes literal in the HTML.
3. Keep margins, `space-y-*`, and other context-dependent spacing on the layout parent in the HTML (`class="copy-punchy mt-8 space-y-5"`).
4. Swap every occurrence, then `npm run build`.
5. Check the page at ~375px and ~1280px looks unchanged (`sm:` variants are the usual casualty).

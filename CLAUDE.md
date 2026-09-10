# Project conventions

- Avoid shadows. Don't add `shadow-*` utilities, and where a daisyUI component still shows a shadow by default, apply `shadow-none` to remove it.
- Only remove a shadow on an element you're actively changing as part of the current task. Don't strip shadows from unrelated elements you happen to touch or pass through — a shadow outside the current task's scope was added intentionally and should be left alone unless the user asks about it.
- Prefer daisyUI's own component classes (e.g. `btn`, `card`, `input`) over building the same thing from raw Tailwind utilities. Fall back to plain Tailwind only for layout/spacing or when daisyUI has no matching component.
- Escape `&` as `&amp;` in HTML text content (headings, copy, etc.) — don't leave bare ampersands.
- When adapting pasted/legacy copy, fix obvious typos and spelling errors silently rather than preserving them verbatim. Only flag a change if the intended wording is ambiguous.
- This site's icon system is lucide (`<i data-lucide="...">` + `vendor/lucide.min.js`). When adapting legacy markup that references a different icon set (e.g. Material Symbols), convert it to the closest lucide equivalent rather than mixing icon libraries.
- Gradient text colors (`bg-gradient-to-r from-* to-*`) are picked per section to fit that section's content — there's no fixed palette to cycle through. Just avoid repeating the same gradient in adjacent sections.

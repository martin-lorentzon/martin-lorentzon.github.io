# Project conventions

- Avoid shadows. Don't add `shadow-*` utilities, and where a daisyUI component still shows a shadow by default, apply `shadow-none` to remove it.
- Only remove a shadow on an element you're actively changing as part of the current task. Don't strip shadows from unrelated elements you happen to touch or pass through — a shadow outside the current task's scope was added intentionally and should be left alone unless the user asks about it.
- Prefer daisyUI's own component classes (e.g. `btn`, `card`, `input`) over building the same thing from raw Tailwind utilities. Fall back to plain Tailwind only for layout/spacing or when daisyUI has no matching component.

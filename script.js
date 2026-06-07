
// Mobile navigation: toggle menu on burger click
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");

    toggle.addEventListener("click", () => {
    links.classList.toggle("open");
    toggle.classList.toggle("active");
    });

    links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.classList.remove("active");
    }),
    );
});

// Track mouse cursor to update CSS variables for the radial text gradient
const gradientTexts = document.querySelectorAll('.gradient-text');

window.addEventListener('mousemove', (e) => {
  for (const el of gradientTexts) {
    const rect = el.getBoundingClientRect();

    el.style.setProperty('--x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }
});
/**
 * Initializes all navigation-related behaviors (mobile menu toggle and scroll fade).
 */
export function initNavbar() {
    initMobileMenu();
    initNavbarScroll();
}

/**
 * Manages mobile menu toggle states and automatic closing upon link selection.
 */
function initMobileMenu() {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");

    if (!toggle || !links) return;

    toggle.addEventListener("click", () => {
        links.classList.toggle("open");
        toggle.classList.toggle("active");
    });

    const navLinks = links.querySelectorAll("a");
    for (const a of navLinks) {
        a.addEventListener("click", () => {
            links.classList.remove("open");
            toggle.classList.remove("active");
        });
    }
}

/**
 * Handles the navbar background fade effect based on vertical scroll position.
 */
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const scrollThreshold = 50;

    window.addEventListener('scroll', () => {
        if (window.scrollY > scrollThreshold) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}
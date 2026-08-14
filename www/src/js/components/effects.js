/**
 * Initializes all page-wide visual effects (gradients, scroll behaviors, etc.)
 */
export function initEffects() {
    initGradientText();
    initScrollFadeIn();
}

/**
 * Tracks mouse and scroll to update CSS variables for radial text gradients.
 */
function initGradientText() {
    const gradientTexts = document.querySelectorAll('.gradient-text');
    if (gradientTexts.length === 0) return;

    let lastMouseX = 0;
    let lastMouseY = 0;

    function updateGradients(clientX, clientY) {
        for (const el of gradientTexts) {
            const rect = el.getBoundingClientRect();

            el.style.setProperty('--x', `${((clientX - rect.left) / rect.width) * 100}%`);
            el.style.setProperty('--y', `${((clientY - rect.top) / rect.height) * 100}%`);
        }
    }

    window.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        updateGradients(lastMouseX, lastMouseY);
    });
    
    window.addEventListener('scroll', () => {
        updateGradients(lastMouseX, lastMouseY);
    });
}

/**
 * Observes elements with the fade-in class and reveals them on scroll.
 */
function initScrollFadeIn() {
    const fadeElements = document.querySelectorAll('.scroll-fade');
    if (fadeElements.length === 0) return;

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -20px 0px',
        threshold: 0.1
    });

    fadeElements.forEach(element => observer.observe(element));
}
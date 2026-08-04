/**
 * Initializes sliding outline indicator behaviors globally without needing a container class.
 */
export function initConfiguratorUI() {
    const groups = document.querySelectorAll('.configurator-row, .configurator-column, .configurator-grid');
    if (groups.length === 0) return;

    for (const group of groups) {
        initSlidingIndicator(group);
    }
}

/**
 * Sets up a single button group with a floating body-level or relative indicator.
 * @param {HTMLElement} group 
 */
function initSlidingIndicator(group) {
    const indicator = group.querySelector('.selection-indicator');
    const buttons = group.querySelectorAll('.configurator-square-btn');
    
    if (!indicator || buttons.length === 0) return;

    function updateIndicator(selectedButton) {
        const groupRect = group.getBoundingClientRect();
        const btnRect = selectedButton.getBoundingClientRect();

        const top = btnRect.top - groupRect.top;
        const left = btnRect.left - groupRect.left;
        const width = btnRect.width;
        const height = btnRect.height;
        const offset = 3; 

        indicator.style.width = `${width + (offset * 2)}px`;
        indicator.style.height = `${height + (offset * 2)}px`;
        indicator.style.transform = `translate(${left - offset}px, ${top - offset}px)`;
    }

    for (const btn of buttons) {
        btn.addEventListener('click', () => {
            for (const b of buttons) {
                b.classList.remove('is-selected');
            }
            btn.classList.add('is-selected');
            updateIndicator(btn);
        });
    }

    // Initialize position for the default selected button
    const initialSelected = group.querySelector('.configurator-square-btn.is-selected');
    if (initialSelected) {
        requestAnimationFrame(() => updateIndicator(initialSelected));
    }

    // Recalculate on window resize
    window.addEventListener('resize', () => {
        const currentSelected = group.querySelector('.configurator-square-btn.is-selected');
        if (currentSelected) {
            updateIndicator(currentSelected);
        }
    });
}
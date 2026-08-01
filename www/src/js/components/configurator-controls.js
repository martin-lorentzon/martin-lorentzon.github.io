/**
 * Initializes sliding outline indicator behaviors globally without needing a container class.
 */
export function initConfiguratorControls() {
    // Find all grids that contain square buttons
    const groups = document.querySelectorAll('.configurator-controls-grid');
    if (groups.length === 0) return;

    for (const group of groups) {
        initSingleGroup(group);
    }
}

/**
 * Sets up a single button group with a floating body-level or relative indicator.
 * @param {HTMLElement} group 
 */
function initSingleGroup(group) {
    const indicator = group.querySelector('.selection-indicator');
    const buttons = group.querySelectorAll('.configurator-square-btn');
    
    if (!indicator || buttons.length === 0) return;

    // Optional: If you want the indicator to break out of layout constraints safely, 
    // you can move it to the body, but keeping it inside the group works if the group has position: relative.
    // Let's ensure the group acts as the reference point via inline style or CSS:
    if (getComputedStyle(group).position === 'static') {
        group.style.position = 'relative';
    }

    function updateIndicator(selectedButton) {
        // Get the group's bounding box and the selected button's bounding box
        const groupRect = group.getBoundingClientRect();
        const btnRect = selectedButton.getBoundingClientRect();

        // Calculate position relative to the group itself
        const top = btnRect.top - groupRect.top;
        const left = btnRect.left - groupRect.left;
        const width = btnRect.width;
        const height = btnRect.height;
        const offset = 3; 

        indicator.style.width = `${width + (offset * 2)}px`;
        indicator.style.height = `${height + (offset * 2)}px`;
        indicator.style.transform = `translate(${left - offset}px, ${top - offset}px)`;
    }

    // Attach click events
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
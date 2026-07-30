import { initNavigation } from './js/components/navigation.js';
import { initEffects } from './js/components/effects.js';
import { initCarConfigurator } from './js/components/car-configurator.js';

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initEffects();
    initCarConfigurator();
});


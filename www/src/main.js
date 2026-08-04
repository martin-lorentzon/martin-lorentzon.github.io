import { initNavbar } from './js/components/navbar.js';
import { initEffects } from './js/components/effects.js';
import { initConfiguratorUI } from './js/components/configurator-ui.js';
import { initConfigurator } from './js/components/configurator.js';

document.addEventListener("DOMContentLoaded", () => {
    initNavbar();
    initEffects();
    initConfiguratorUI();
    initConfigurator();
});


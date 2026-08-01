import { initNavigation } from './js/components/navigation.js';
import { initEffects } from './js/components/effects.js';
import { initConfiguratorControls } from './js/components/configurator-controls.js';
import { initConfigurator } from './js/components/configurator.js';

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initEffects();
    initConfiguratorControls();
    initConfigurator();
});


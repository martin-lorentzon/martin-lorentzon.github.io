import { parseColorToFactor } from '../utils.js';

/**
 * Initializes all car configurator behaviors (backdrop toggle and material color customisation).
 */
export function initCarConfigurator() {
    initBackdropToggle();
    initColorControls();
}

/**
 * Manages the background environment toggle for the model viewer (skybox vs environment image).
 */
function initBackdropToggle() {
    const modelViewer = document.querySelector('#car-configurator-viewer');
    const backdropBtn = document.querySelector('#backdrop-toggle');
    
    if (!modelViewer || !backdropBtn) return;

    const envImage = './environments/skidpan_2k.hdr';
    let isSkyboxActive = true; 

    backdropBtn.addEventListener('click', () => {
        isSkyboxActive = !isSkyboxActive;

        if (isSkyboxActive) {
            modelViewer.setAttribute('skybox-image', envImage);
            modelViewer.removeAttribute('environment-image');
        } else {
            modelViewer.setAttribute('environment-image', envImage);
            modelViewer.removeAttribute('skybox-image');
        }
    });
}

/**
 * Manages color selection highlights and smooth material color animations on the 3D model.
 */
function initColorControls() {
    const modelViewer = document.querySelector('#car-configurator-viewer');
    const container = document.getElementById("car-color-options");
    
    if (!modelViewer || !container) return;

    const buttons = container.querySelectorAll(".configurator-square-btn");
    const colorControls = document.querySelectorAll('.color-controls');

    // Manage the 'is-selected' tag to highlight the active button
    for (const button of buttons) {
        button.addEventListener("click", () => {
            for (const btn of buttons) {
                btn.classList.remove("is-selected");
            }
            button.classList.add("is-selected");
        });
    }

    /**
     * Smoothly animates the material car paint color transition.
     */
    function changeMaterialColor(targetElement, duration = 1000) {
        const material = modelViewer.model?.getMaterialByName("primal_car_paint.001");
        if (!material) return;

        const start = material.pbrMetallicRoughness.baseColorFactor;
        const end = parseColorToFactor(targetElement);
        const startTime = performance.now();

        const animate = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const color = start.map((value, i) => value + (end[i] - value) * progress);
            material.pbrMetallicRoughness.setBaseColorFactor(color);
            if (progress < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    for (const button of colorControls) {
        button.addEventListener('click', (event) => {
            changeMaterialColor(event.target);
        });
    }

    modelViewer.addEventListener('load', () => {
        const selectedButton = document.querySelector('.color-controls.is-selected');
        if (selectedButton) {
            changeMaterialColor(selectedButton, 0);
        }
    });
}
import { parseColorToFactor } from '../utils.js';

/**
 * Initializes all configurator behaviors (backdrop toggle and material color customisation).
 */
export function initConfigurator() {
    const modelViewer = document.getElementById("configurator-viewer");
    initBackdropToggle(modelViewer);
    initColorControls(modelViewer);
}

/**
 * Manages the background environment toggle for the model viewer (skybox vs environment image).
 */
function initBackdropToggle(targetModelViewer) {
    const backdropBtn = document.getElementById("backdrop-toggle");
    
    if (!targetModelViewer || !backdropBtn) return;

    const envImage = './environments/skidpan_2k.hdr';
    let isSkyboxActive = true; 

    backdropBtn.addEventListener('click', () => {
        isSkyboxActive = !isSkyboxActive;

        if (isSkyboxActive) {
            targetModelViewer.setAttribute('skybox-image', envImage);
            targetModelViewer.removeAttribute('environment-image');
        } else {
            targetModelViewer.setAttribute('environment-image', envImage);
            targetModelViewer.removeAttribute('skybox-image');
        }
    });
}

/**
 * Manages color selection highlights and smooth material color animations on the 3D model.
 */
function initColorControls(targetModelViewer) {
    const container = document.getElementById("color-options");
    
    if (!targetModelViewer || !container) return;

    const buttons = container.querySelectorAll(".configurator-square-btn");
    const colorControls = document.querySelectorAll('.color-option'); //TODO: Reconsider element and variable naming to make it easier to reason about

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
     * Smoothly animates the material color transition.
     */
    function changeMaterialColor(targetElement, duration = 1000) {
        const material = targetModelViewer.model?.getMaterialByName("primal_car_paint.001");
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

    targetModelViewer.addEventListener('load', () => {
        const selectedButton = document.querySelector('.color-option.is-selected');
        if (selectedButton) {
            changeMaterialColor(selectedButton, 0);
        }
    });
}

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
  const navbar = document.querySelector('.navbar');
  
  // ADJUST THIS VALUE: Number of pixels scrolled before the navbar fades
  const scrollThreshold = 50; 

  if (window.scrollY > scrollThreshold) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }

  updateGradients(lastMouseX, lastMouseY);
});

const modelViewer = document.querySelector('#car-configurator-viewer');
const backdropBtn = document.querySelector('#backdrop-toggle');
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



// Car Color Options
const container = document.getElementById("car-color-options");
const buttons = container.querySelectorAll(".configurator-square-btn");

buttons.forEach(button => {
  button.addEventListener("click", function() {
    buttons.forEach(btn => btn.classList.remove("is-selected"));
    this.classList.add("is-selected");
  });
});



document.querySelectorAll('.color-controls').forEach(button => {
  button.addEventListener('click', (event) => {
    const material = modelViewer.model?.getMaterialByName("primal_car_paint.001");
    if (!material) return;

    // Use event.target to get the specific button clicked
    const style = window.getComputedStyle(event.target);
    const bgColor = style.backgroundColor;

    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const target = match 
      ? [
          parseInt(match[1]) / 255, 
          parseInt(match[2]) / 255, 
          parseInt(match[3]) / 255, 
          match[4] ? parseFloat(match[4]) : 1
        ] 
      : [1, 1, 1, 1];

    const start = [...material.pbrMetallicRoughness.baseColorFactor];
    const startTime = performance.now();
    const duration = 1000;

    const animate = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const current = start.map((s, i) => s + (target[i] - s) * p);
      
      material.pbrMetallicRoughness.setBaseColorFactor(current);
      if (p < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  });
});
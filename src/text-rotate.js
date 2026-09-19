const HOLD_DURATION = 2200; // ms each word stays fully visible
const SWAP_DURATION = 300; // ms for each word's own blur/slide transition
const OVERLAP_DELAY = 200; // ms after the outgoing word starts before the incoming one follows

const el = document.querySelector('[data-text-rotate]');
if (el) initTextRotate(el);

function initTextRotate(el) {
  const words = (el.dataset.textRotateWords || '').split('|').map((word) => word.trim()).filter(Boolean);
  if (words.length < 2) return;

  // Reserve width/height for the widest word so surrounding text never shifts. Invisible copies of
  // every word share one grid cell, so the browser sizes the slot itself (including when the web
  // font replaces the fallback) instead of us measuring pixels. Live words are absolutely
  // positioned on top and stack while swapping.
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.style.display = 'inline-grid';
  el.textContent = '';
  for (const word of words) el.appendChild(addSizer(word));
  let current = addLayer(el, words[0]);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let index = 0;
  cycle();

  async function cycle() {
    await wait(HOLD_DURATION);
    index = (index + 1) % words.length;
    const incoming = addLayer(el, words[index]);
    await Promise.all([animateWord(current, 'out', 0), animateWord(incoming, 'in', OVERLAP_DELAY)]);
    current.remove();
    current = incoming;
    cycle();
  }
}

function addLayer(el, text) {
  const layer = document.createElement('span');
  layer.textContent = text;
  layer.style.position = 'absolute';
  layer.style.inset = '0';
  el.appendChild(layer);
  return layer;
}

function addSizer(text) {
  const sizer = document.createElement('span');
  sizer.textContent = text;
  sizer.style.gridArea = '1 / 1';
  sizer.style.visibility = 'hidden';
  sizer.setAttribute('aria-hidden', 'true');
  return sizer;
}

function animateWord(el, direction, delay) {
  const offset = direction === 'out' ? '-0.4em' : '0.4em';
  const rest = { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0)' };
  const shifted = { opacity: 0, filter: 'blur(4px)', transform: `translateY(${offset})` };
  const keyframes = direction === 'out' ? [rest, shifted] : [shifted, rest];

  const animation = el.animate(keyframes, {
    duration: SWAP_DURATION,
    delay,
    easing: direction === 'out' ? 'ease-in' : 'ease-out',
    fill: 'both', // holds the incoming word's hidden start state during its delay
  });
  return animation.finished;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

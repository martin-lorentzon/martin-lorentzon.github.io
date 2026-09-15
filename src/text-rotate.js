const HOLD_DURATION = 2200; // ms each word stays fully visible
const SWAP_DURATION = 320; // ms for each word's own blur/slide transition
const OVERLAP_DELAY = 180; // ms after the outgoing word starts before the incoming one follows

const el = document.querySelector('[data-text-rotate]');
if (el) initTextRotate(el);

function initTextRotate(el) {
  const words = (el.dataset.textRotateWords || '').split('|').map((word) => word.trim()).filter(Boolean);
  if (words.length < 2) return;

  // Reserve width/height for the widest word so surrounding text never shifts,
  // and let the current + incoming words stack on top of each other while swapping.
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  syncSlotSize(el, words);
  window.addEventListener('resize', () => syncSlotSize(el, words));

  el.textContent = '';
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

function syncSlotSize(el, words) {
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'nowrap';
  probe.style.font = getComputedStyle(el).font;
  document.body.appendChild(probe);

  let maxWidth = 0;
  let maxHeight = 0;
  for (const word of words) {
    probe.textContent = word;
    const rect = probe.getBoundingClientRect();
    maxWidth = Math.max(maxWidth, rect.width);
    maxHeight = Math.max(maxHeight, rect.height);
  }
  probe.remove();

  el.style.width = `${Math.ceil(maxWidth)}px`;
  el.style.height = `${Math.ceil(maxHeight)}px`;
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

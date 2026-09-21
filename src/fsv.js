// Pinned full-screen views (docs/full-screen-views.md). For each .fsv section: writes scroll progress
// through the pinned stretch as --fsv-p (0-1), which scrubs the slide of image A, and data-state (0-3)
// at the scroll points below, which triggers the timed fades. Both are consumed in src/input.css
// (.fsv-pinned). Skipped for reduced motion, which keeps the plain stacked layout.
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".fsv").forEach(init);
}

function init(section) {
  const stage = section.querySelector(".fsv-stage");
  if (!stage) return;
  section.classList.add("fsv-pinned");

  // Tuning knobs: data-zone-* on the section, in svh of scroll distance.
  //   image        each untinted view (A, then B)
  //   text         each text view (first, then second)
  //   slide-delay  tinted A with no text before the slide starts, so the text has faded out first (default 10)
  //   slide        A sliding up and away (scrubbed; the only zone that follows the scroll 1:1)
  // Scroll order: image A, text 1, slide-delay, slide, image B, text 2. Everything below (runway
  // height, --fsv-p scroll points, slide range, arrow stops) derives from that.
  const knob = (name, fallback = 0) => {
    const value = parseFloat(section.getAttribute(`data-zone-${name}`));
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  };
  const image = knob("image");
  const text = knob("text");
  const zoneNames = ["image-a", "text-1", "slide-delay", "slide", "image-b", "text-2"];
  const zones = [image, text, knob("slide-delay", 10), knob("slide"), image, text];
  const total = zones.reduce((sum, zone) => sum + zone, 0) || 1;
  const ends = zones.map((_, i) => zones.slice(0, i + 1).reduce((sum, zone) => sum + zone, 0) / total);
  const starts = [0, ...ends.slice(0, -1)];
  const zone = Object.fromEntries(zoneNames.map((name, i) => [name, { start: starts[i], end: ends[i] }]));

  section.style.setProperty("--fsv-zone-total", `${total}svh`);
  section.style.setProperty("--fsv-slide-start", zone.slide.start.toFixed(4));
  section.style.setProperty("--fsv-slide-len", Math.max(zone.slide.end - zone.slide.start, 0.0001).toFixed(4));

  // --fsv-p at which the state steps up: tint A + text 1 in, text 1 out, tint B + text 2 in.
  const triggers = [zone["image-a"].end, zone["text-1"].end, zone["image-b"].end];
  const hysteresis = 0.01;
  let state = 0;
  const stateFor = (progress) => {
    while (state < triggers.length && progress >= triggers[state]) state++;
    while (state > 0 && progress < triggers[state - 1] - hysteresis) state--;
    return state;
  };

  let queued = false;
  const update = () => {
    queued = false;
    const pinnedTop = parseFloat(getComputedStyle(stage).top);
    const range = section.offsetHeight - stage.offsetHeight;
    const progress = Math.min(1, Math.max(0, (pinnedTop - section.getBoundingClientRect().top) / range));
    section.style.setProperty("--fsv-p", progress.toFixed(4));
    section.dataset.state = stateFor(progress);
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };

  // Views the arrow steps through: the middle of each hold zone. Past the last one it follows its href
  // to the next section.
  const holds = ["text-1", "image-b", "text-2"].map((name) => (zone[name].start + zone[name].end) / 2);
  section.querySelector("[data-fsv-next]")?.addEventListener("click", (event) => {
    const range = section.offsetHeight - stage.offsetHeight;
    const progress = parseFloat(section.style.getPropertyValue("--fsv-p")) || 0;
    const next = holds.find((hold) => hold > progress + 0.02);
    if (next === undefined) return;
    event.preventDefault();
    const pinnedTop = parseFloat(getComputedStyle(stage).top);
    const sectionTop = section.getBoundingClientRect().top + scrollY;
    scrollTo({ top: sectionTop - pinnedTop + next * range, behavior: "smooth" });
  });

  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  update();
  // Enable the fade transitions only after the first state is applied, so a reload mid-section
  // doesn't animate in from state 0.
  requestAnimationFrame(() => requestAnimationFrame(() => section.classList.add("fsv-animated")));
}

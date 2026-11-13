type MotionElement = HTMLElement;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const motionOff = () => reduced.matches || root.classList.contains('reduce-motion');

const revealSelector = [
  '.stat','.subject-card','.panel','.section-title','.explore-strip','.adventure-hero',
  '.ai-hero','.page-title','.exam-question','.raiva-question-card','.admin-user-row',
  '.resource-card','.lesson-card','.universe-card','.quest-card','.mission-row',
  '.profile-card','.achievement-card','.book-card','.video-card','.tool-card',
  '.messenger-card','.chat-item','.message-bubble','.settings-card','.dashboard-card'
].join(',');

let revealObserver: IntersectionObserver | undefined;
let mutationObserver: MutationObserver | undefined;
let cursorGlow: HTMLDivElement | undefined;
let scrollBar: HTMLDivElement | undefined;
let raf = 0;

function ensureMotionDecorations() {
  if (!scrollBar) {
    scrollBar = document.createElement('div');
    scrollBar.className = 'sc-scroll-progress';
    scrollBar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(scrollBar);
  }
  if (!cursorGlow && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    cursorGlow = document.createElement('div');
    cursorGlow.className = 'sc-cursor-glow';
    cursorGlow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursorGlow);
  }
}

function updateScrollProgress() {
  if (!scrollBar) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const value = max > 0 ? window.scrollY / max : 0;
  scrollBar.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
}

function observeReveal(scope: ParentNode = document) {
  if (motionOff() || !revealObserver) return;
  scope.querySelectorAll<MotionElement>(revealSelector).forEach((el, index) => {
    if (el.dataset.scRevealReady) return;
    el.dataset.scRevealReady = '1';
    el.classList.add('sc-reveal');
    el.style.setProperty('--sc-stagger', `${Math.min(index % 7, 6) * 48}ms`);
    revealObserver!.observe(el);
  });
}

function addRipple(event: PointerEvent) {
  if (motionOff() || event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLElement>('button, .primary, .secondary, .circle-button, .nav-link, .tabs button');
  if (!button || button.matches(':disabled,[aria-disabled="true"]')) return;
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'sc-ripple';
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  button.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 720);
  button.classList.remove('sc-pressed');
  requestAnimationFrame(() => button.classList.add('sc-pressed'));
  window.setTimeout(() => button.classList.remove('sc-pressed'), 240);
}

function pointerMove(event: PointerEvent) {
  if (motionOff()) return;
  if (cursorGlow) {
    cursorGlow.style.setProperty('--sc-pointer-x', `${event.clientX}px`);
    cursorGlow.style.setProperty('--sc-pointer-y', `${event.clientY}px`);
    cursorGlow.classList.add('is-visible');
  }
  const target = event.target;
  if (!(target instanceof Element)) return;
  const card = target.closest<HTMLElement>('.subject-card,.stat,.panel,.tool-card,.lesson-card,.universe-card,.quest-card,.achievement-card');
  if (!card || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const rect = card.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  card.style.setProperty('--sc-spot-x', `${x * 100}%`);
  card.style.setProperty('--sc-spot-y', `${y * 100}%`);
  if (card.matches('.subject-card,.tool-card,.lesson-card,.universe-card,.quest-card,.achievement-card')) {
    card.style.setProperty('--sc-tilt-x', `${(0.5 - y) * 4}deg`);
    card.style.setProperty('--sc-tilt-y', `${(x - 0.5) * 5}deg`);
    card.classList.add('sc-tilting');
  }
}

function resetTilt(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const card = target.closest<HTMLElement>('.sc-tilting');
  if (!card) return;
  card.classList.remove('sc-tilting');
  card.style.removeProperty('--sc-tilt-x');
  card.style.removeProperty('--sc-tilt-y');
}

function animateRoute() {
  if (motionOff()) return;
  const main = document.querySelector<HTMLElement>('#main');
  if (!main) return;
  main.classList.remove('sc-page-enter');
  void main.offsetWidth;
  main.classList.add('sc-page-enter');
  observeReveal(main);
}

function initSmartClassMotion() {
  if (root.dataset.scMotionInit === 'true') return;
  root.dataset.scMotionInit = 'true';
  root.classList.add('sc-motion-ready');
  ensureMotionDecorations();

  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('sc-revealed');
        revealObserver?.unobserve(entry.target);
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -28px 0px' });
  }

  observeReveal();
  updateScrollProgress();
  document.addEventListener('pointerdown', addRipple, { passive: true });
  document.addEventListener('pointermove', pointerMove, { passive: true });
  document.addEventListener('pointerout', resetTilt, { passive: true });
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { updateScrollProgress(); raf = 0; });
  }, { passive: true });
  window.addEventListener('resize', updateScrollProgress, { passive: true });
  window.addEventListener('hashchange', animateRoute);

  mutationObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) observeReveal(node);
    }));
  });
  mutationObserver.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
  reduced.addEventListener?.('change', () => {
    if (motionOff()) {
      document.querySelectorAll('.sc-reveal').forEach(el => el.classList.add('sc-revealed'));
      cursorGlow?.classList.remove('is-visible');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSmartClassMotion, { once: true });
} else {
  initSmartClassMotion();
}

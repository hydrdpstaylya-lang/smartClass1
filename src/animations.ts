const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionDisabled = () => reduceMotion || document.documentElement.classList.contains('reduce-motion');

const revealSelector = [
  '.stat', '.subject-card', '.panel', '.section-title', '.explore-strip',
  '.adventure-hero', '.ai-hero', '.page-title', '.exam-question',
  '.raiva-question-card', '.admin-user-row', '.resource-card'
].join(',');

function prepareReveal(root: ParentNode = document) {
  if (motionDisabled() || !('IntersectionObserver' in window)) return;
  const nodes = root.querySelectorAll<HTMLElement>(revealSelector);
  nodes.forEach((node, index) => {
    if (node.dataset.scRevealReady) return;
    node.dataset.scRevealReady = 'true';
    node.classList.add('sc-reveal');
    node.style.setProperty('--sc-reveal-delay', `${Math.min(index % 5, 4) * 55}ms`);
    observer.observe(node);
  });
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('sc-revealed');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

function addPressFeedback(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLElement>('button, .primary, .secondary, .circle-button');
  if (!button || button.matches(':disabled,[aria-disabled="true"]') || motionDisabled()) return;
  button.classList.remove('sc-pressed');
  requestAnimationFrame(() => {
    button.classList.add('sc-pressed');
    window.setTimeout(() => button.classList.remove('sc-pressed'), 220);
  });
}

function initSmartClassMotion() {
  if (document.documentElement.dataset.scMotionInit === 'true') return;
  document.documentElement.dataset.scMotionInit = 'true';
  document.documentElement.classList.add('sc-motion-ready');
  prepareReveal();
  document.addEventListener('pointerdown', addPressFeedback, { passive: true });
  const refresh = () => prepareReveal();
  const mutationObserver = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        if (node.matches(revealSelector)) prepareReveal(node.parentElement ?? document);
        else prepareReveal(node);
      }
    }));
  });
  mutationObserver.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', refresh);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSmartClassMotion, { once: true });
} else {
  initSmartClassMotion();
}

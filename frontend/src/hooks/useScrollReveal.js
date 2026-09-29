import { useEffect } from "react";

// Blocks that rise into view as you scroll. Content already on screen is left alone (no flash),
// and nothing is hidden when motion is reduced or the browser has no IntersectionObserver.
const TARGETS = [
  ".section__intro", ".stage-grid > li", ".feature-groups > *", ".steps > li", ".cta-band",
  ".grid > li", ".career-field__head", ".option-card", ".rec-card", ".dash-step", ".detail-block",
].join(", ");

export default function useScrollReveal(root, key) {
  useEffect(() => {
    const container = root.current;
    if (!container || typeof IntersectionObserver === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const timers = new Set();
    const seen = new WeakSet();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        observer.unobserve(el);
        el.classList.add("is-visible");
        // Drop the classes afterwards so hover effects (lift on cards) work normally again
        const delay = Number(el.style.getPropertyValue("--reveal-i") || 0) * 70;
        const t = window.setTimeout(() => {
          el.classList.remove("reveal", "is-visible");
          el.style.removeProperty("--reveal-i");
          timers.delete(t);
        }, 750 + delay);
        timers.add(t);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    const scan = () => {
      const below = window.innerHeight;
      container.querySelectorAll(TARGETS).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.getBoundingClientRect().top < below) return; // already on screen: show as is
        // Stagger siblings in the same row a little
        const index = Array.prototype.indexOf.call(el.parentElement?.children || [], el) % 4;
        el.style.setProperty("--reveal-i", String(Math.max(0, index)));
        el.classList.add("reveal");
        observer.observe(el);
      });
    };

    scan();
    // Pages load their data after the first render; pick up new blocks as they appear
    const mutations = new MutationObserver(scan);
    mutations.observe(container, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
      container.querySelectorAll(".reveal").forEach((el) => el.classList.remove("reveal", "is-visible"));
    };
  }, [root, key]);
}

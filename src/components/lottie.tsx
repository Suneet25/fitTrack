"use client";

import { useEffect, useRef } from "react";

/**
 * Plays a Lottie animation from /public (e.g. src="/lottie/hero-lift.json").
 *
 * Built to never cost page speed:
 * - Nothing loads until the element is about to scroll into view (the player code is
 *   shared, fetched once, and only after the page is interactive).
 * - Uses lottie-web's light SVG build: smaller, and it never evaluates expressions (no eval).
 * - Pauses while off-screen, so only visible animations use CPU.
 * - `playOnce` plays a single time when first seen and rests on a finished frame, so a page
 *   can have one looping hero and calm, settled illustrations everywhere else.
 * - Shows the resting frame for reduced motion or Data Saver.
 * - Decorative by default (hidden from screen readers); pass `label` if it carries meaning.
 */
export function Lottie({
  src,
  playOnce,
  onLoopComplete,
  label,
  className = "",
}: {
  src: string;
  /** Play once, then stop at this point of the animation (0–1). Loops when omitted. */
  playOnce?: number;
  /** Called each time a looping animation finishes a cycle (e.g. to move to the next one). */
  onLoopComplete?: () => void;
  label?: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  // Latest callback without re-creating the animation when the parent re-renders.
  const onLoopCompleteRef = useRef(onLoopComplete);
  useEffect(() => {
    onLoopCompleteRef.current = onLoopComplete;
  });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let cleanup = () => {};

    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

    async function start() {
      const { default: lottie } = await import("lottie-web/build/player/lottie_light");
      if (cancelled || !el) return;
      const anim = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        path: src,
        loop: playOnce === undefined,
        autoplay: false,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: true },
      });
      const restFrame = () => Math.round(anim.totalFrames * (playOnce ?? 0.6));
      let started = false;
      let finished = false;
      anim.addEventListener("complete", () => {
        finished = true;
      });
      anim.addEventListener("loopComplete", () => onLoopCompleteRef.current?.());
      const visibility = new IntersectionObserver(([entry]) => {
        if (still || finished) return;
        if (!entry.isIntersecting) return anim.pause();
        if (playOnce !== undefined && !started) anim.playSegments([0, restFrame()], true);
        else anim.play();
        started = true;
      });
      anim.addEventListener("DOMLoaded", () => {
        if (still) anim.goToAndStop(restFrame(), true);
        visibility.observe(el);
      });
      cleanup = () => {
        visibility.disconnect();
        anim.destroy();
      };
    }

    // Load only when within ~one screen of the viewport.
    const nearby = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        nearby.disconnect();
        start();
      },
      { rootMargin: "300px" },
    );
    nearby.observe(el);

    return () => {
      cancelled = true;
      nearby.disconnect();
      cleanup();
    };
  }, [src, playOnce]);

  return (
    <div
      ref={container}
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}

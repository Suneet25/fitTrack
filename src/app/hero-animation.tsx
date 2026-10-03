"use client";

import { useState } from "react";
import { Lottie } from "@/components/lottie";

const slides = [
  { src: "/lottie/hero-lift.json", label: "Workouts" },
  { src: "/lottie/diet-bowl.json", label: "Nutrition" },
  { src: "/lottie/activity-watch.json", label: "Activity" },
];

/**
 * The page's one animation: cycles Workouts → Nutrition → Activity, moving on each time
 * the current animation finishes a loop. Only the visible slide is mounted, so only one
 * animation ever runs. With reduced motion the first slide shows as a still frame.
 */
export function HeroAnimation() {
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="relative min-h-0 w-full flex-1">
        <div className="hero-glow absolute inset-0 rounded-full" aria-hidden />
        <Lottie
          key={slide.src}
          src={slide.src}
          onLoopComplete={() => setIndex((i) => (i + 1) % slides.length)}
          className="slide-in relative h-full w-full"
        />
      </div>

      <div className="mt-2 flex items-center gap-3" data-analytics-ignore>
        <span key={slide.label} className="slide-in w-20 text-right text-xs font-semibold uppercase tracking-widest text-ink-muted">
          {slide.label}
        </span>
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${s.label.toLowerCase()} animation`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-5 bg-primary-500" : "w-1.5 bg-line hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

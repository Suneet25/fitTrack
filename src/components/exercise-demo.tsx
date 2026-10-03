import Image from "next/image";
import { imageUrl, type Exercise } from "@/lib/workouts/exercises";

/**
 * Looping exercise demo: the demo clip when there is one, otherwise the start and
 * end photos cross-fading (static for people who prefer reduced motion).
 */
export function ExerciseDemo({ exercise: ex }: { exercise: Exercise }) {
  if (ex.demoVideo) {
    return (
      <video
        src={ex.demoVideo}
        poster={imageUrl(ex.images[0])}
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label={`${ex.name} demo`}
        className="aspect-[4/3] w-full bg-black object-cover"
      />
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full bg-surface-muted" role="img" aria-label={`${ex.name} demo`}>
      <Image
        src={imageUrl(ex.images[0])}
        alt=""
        fill
        loading="eager"
        sizes="(min-width: 1024px) 580px, 100vw"
        className="object-cover"
      />
      {ex.images[1] && (
        <Image
          src={imageUrl(ex.images[1])}
          alt=""
          fill
          loading="eager"
          sizes="(min-width: 1024px) 580px, 100vw"
          className="demo-end-frame object-cover"
        />
      )}
    </div>
  );
}

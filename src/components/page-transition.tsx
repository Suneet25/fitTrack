import { ViewTransition } from "react";

/**
 * Animates a page's content when navigating to or from it.
 *
 * Links pass `transitionTypes={["nav-forward"]}` when going deeper (list → detail) and
 * `["nav-back"]` when returning; anything else (header tabs, browser back) gets a quick fade.
 * Refreshes and search-param changes keep the same page mounted, so they don't animate.
 * Use it in each page.tsx, not a layout — layouts persist, so enter/exit never fire there.
 * Styles live in globals.css (::view-transition-* rules).
 */
const motion = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-fade" };

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={motion} exit={motion} default="none">
      {children}
    </ViewTransition>
  );
}

/** Link transition types, so call sites don't repeat string literals. */
export const FORWARD = ["nav-forward"];
export const BACK = ["nav-back"];

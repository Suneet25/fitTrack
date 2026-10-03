import { APP } from "@/config/app";

export function SiteFooter() {
  return (
    <footer className="site-footer border-t border-line">
      <p className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-ink-muted sm:text-left">
        © {new Date().getFullYear()} {APP.name}. All rights reserved.
      </p>
    </footer>
  );
}

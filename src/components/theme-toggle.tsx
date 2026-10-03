import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { ThemeSwitcher } from "./theme-switcher";

/** The user's saved theme. Read on the server so the first paint is already right. */
export async function getTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

export async function ThemeToggle({ className }: { className?: string }) {
  return <ThemeSwitcher initial={await getTheme()} className={className} />;
}

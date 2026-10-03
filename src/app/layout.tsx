import type { Metadata } from "next";
import { GeistSans as geistSans } from "geist/font/sans";
import { GeistMono as geistMono } from "geist/font/mono";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { SiteFooter } from "@/components/site-footer";
import { getTheme } from "@/components/theme-toggle";
import { APP } from "@/config/app";
import { RemoteConfigProvider } from "@/lib/remote-config/client";
import { getRemoteConfig } from "@/lib/remote-config/server";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: APP.name,
  description: APP.description,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  const [theme, remoteConfig] = await Promise.all([getTheme(), getRemoteConfig()]);

  return (
    <html
      lang="en"
      // "system" leaves it unset so the OS preference applies (see globals.css).
      data-theme={theme === "system" ? undefined : theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <RemoteConfigProvider initial={remoteConfig.values}>
          <AnalyticsProvider userId={userId} />
          <AnnouncementBanner />
          {children}
          <SiteFooter />
        </RemoteConfigProvider>
      </body>
    </html>
  );
}

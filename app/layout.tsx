import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const SITE_URL = "https://charge.fusionspace.co";
const DESCRIPTION =
  "Black-powder ejection-charge calculator for high-power rocketry. Size a charge from your tube, pressurized section, and separation force — with the full formula shown, and a log for the ground tests that actually validate it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Charge — HPR ejection-charge calculator",
  description: DESCRIPTION,
  applicationName: "Charge",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: SITE_URL },
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Charge — HPR ejection-charge calculator",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Fusion Space",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Charge — HPR ejection-charge calculator",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  colorScheme: "light dark",
};

// Set the theme class before first paint so there's no flash. Mirrors the hub and the
// Motor Finder; the key is namespaced per tool.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('charge.theme');var e=document.documentElement;e.classList.toggle('dark',t==='dark');e.classList.toggle('light',t==='light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}

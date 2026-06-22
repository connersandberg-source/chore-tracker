import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";

import { ServiceWorkerRegistrar } from "@/components/shell/service-worker-registrar";
import "./globals.css";

const sans = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const display = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "ChoreTracker",
  title: {
    default: "ChoreTracker",
    template: "%s · ChoreTracker",
  },
  description:
    "A friendly family chore checklist — assign chores, check them off, earn points, and trade them for rewards.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chores",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg?v=1", type: "image/svg+xml" }],
    shortcut: ["/icon.svg?v=1"],
    // A static PNG under a versioned URL: iOS caches home-screen icons by URL
    // and ignores updates, so a changed icon must ship under a new name.
    // Exactly 180×180 — iOS's install-time resampler softens any other size.
    apple: [
      { url: "/apple-touch-icon-v1.png", sizes: "180x180", type: "image/png" },
    ],
  },
  // Older iOS uses the apple-prefixed flag; Next emits the modern one too.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F1",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // Extend under the iPhone notch / home indicator so safe-area insets apply.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}

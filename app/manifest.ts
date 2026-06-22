import type { MetadataRoute } from "next";

// PWA manifest. Icon URLs are versioned (?v=) because iOS/Android cache
// home-screen icons by URL and ignore later changes — bump the version on any
// icon edit so devices re-fetch.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChoreTracker",
    short_name: "Chores",
    description:
      "A friendly family chore checklist — assign chores, check them off, earn points, trade them for rewards.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FBF8F1",
    theme_color: "#FBF8F1",
    icons: [
      {
        src: "/icon.svg?v=2",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg?v=2",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "maskable",
      },
    ],
  };
}

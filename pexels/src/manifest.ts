import { defineManifest } from "@absolutejs/manifest";
import { Type } from "@sinclair/typebox";
export const manifest = defineManifest<Record<string, never>>()({
  contract: 2,
  identity: {
    name: "@absolutejs/stock-images-pexels",
    description:
      "Server-side Pexels search and selection provider for AbsoluteJS stock images.",
    tagline: "Real image results with source metadata intact.",
    category: "content",
    accent: "#38bdf8",
    docsUrl: "https://github.com/absolutejs/stock-images-providers",
  },
  discovery: {
    audiences: ["app-developers", "agent-hosts"],
    intents: [
      "search stock photographs",
      "select a website image with attribution",
    ],
    keywords: ["stock images", "photos", "attribution", "search"],
  },
  settings: Type.Object({}, { additionalProperties: false }),
  wiring: [],
});

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChoreoHub",
    short_name: "ChoreoHub",
    description: "안무 기록·분석 웹앱 ChoreoHub",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      { src: "/logo.png", sizes: "1254x1254", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "1254x1254", type: "image/png", purpose: "maskable" },
    ],
  };
}

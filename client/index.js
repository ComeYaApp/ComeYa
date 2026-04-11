import { registerRootComponent } from "expo";

import App from "@/App";

// Suppress known React Native Web aria-hidden warning (cosmetic, no functional impact)
if (typeof window !== "undefined") {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("aria-hidden")) return;
    originalWarn(...args);
  };
}

registerRootComponent(App);

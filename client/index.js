import { registerRootComponent } from "expo";

import App from "@/App";

// Suppress known React Native Web aria-hidden warning (cosmetic, no functional impact)
if (typeof window !== "undefined") {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("aria-hidden")) return;
    originalWarn(...args);
  };

  // Scrollbar personalizada
  const style = document.createElement("style");
  style.textContent = `
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #E8B4A8; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #FF6B35; }
  `;
  document.head.appendChild(style);
}

registerRootComponent(App);

import { registerRootComponent } from "expo";

import App from "@/App";

// Suppress known React Native Web accessibility warnings (cosmetic, no functional impact)
if (typeof window !== "undefined") {
  const originalWarn = console.warn.bind(console);
  const originalError = console.error.bind(console);
  
  console.warn = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (msg.includes("aria-hidden") || msg.includes("Blocked aria-hidden")) return;
    originalWarn(...args);
  };
  
  console.error = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    if (msg.includes("aria-hidden") || msg.includes("Blocked aria-hidden")) return;
    originalError(...args);
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

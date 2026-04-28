import { registerRootComponent } from "expo";

import App from "@/App";

// Suppress known React Native Web aria-hidden warning (cosmetic, no functional impact)
if (typeof window !== "undefined") {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("aria-hidden")) return;
    originalWarn(...args);
  };

  // Responsive web styles — limita el ancho del contenido en escritorio
  const style = document.createElement("style");
  style.textContent = `
    html, body { margin: 0; padding: 0; background: #f0f0f0; }

    /* En escritorio, centra la app con ancho maximo */
    @media (min-width: 768px) {
      #root > div {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        min-height: 100vh;
        box-shadow: 0 0 40px rgba(0,0,0,0.1);
      }
    }

    /* Scrollbar personalizada */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #E8B4A8; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #FF6B35; }
  `;
  document.head.appendChild(style);
}

registerRootComponent(App);

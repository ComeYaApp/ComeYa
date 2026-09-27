const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  "@": path.resolve(__dirname, "client"),
  "@shared": path.resolve(__dirname, "shared"),
};

// En web, redirigir módulos nativos inexistentes en navegador a shims seguros
const originalResolveRequest = config.resolver.resolveRequest;
const WEB_SHIMS = {
  "react-native-worklets": "client/shims/react-native-worklets.js",
  "@stripe/stripe-react-native": "client/shims/stripe-react-native.js",
};
// Rutas normalizadas para comparar sin depender de mayúsculas ni separadores (Windows)
const normalizePath = (p) => path.resolve(p).replace(/\\/g, "/").toLowerCase();

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_SHIMS[moduleName]) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, WEB_SHIMS[moduleName]),
    };
  }

  const resolved = originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);

  // Un módulo que se resuelve a sí mismo compila a un getter `default` que se lee
  // solo: recursión infinita ("Maximum call stack size exceeded") en runtime. Ocurre
  // cuando un archivo de plataforma reexporta su propio nombre base (Foo.web.tsx =>
  // "./Foo" resuelve a Foo.web.tsx, porque Metro prioriza la extensión .web).
  const origin = context.originModulePath;
  if (origin && resolved?.type === "sourceFile") {
    if (normalizePath(resolved.filePath) === normalizePath(origin)) {
      throw new Error(
        `Self-referencing import: "${moduleName}" resuelve al propio archivo ${origin}. ` +
          `Elimina el reexport/import a sí mismo (habitual en variantes .web/.native).`,
      );
    }
  }

  return resolved;
};

module.exports = config;
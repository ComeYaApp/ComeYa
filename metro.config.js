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
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_SHIMS[moduleName]) {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, WEB_SHIMS[moduleName]),
    };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
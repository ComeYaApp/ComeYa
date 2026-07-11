const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  "@": path.resolve(__dirname, "client"),
  "@shared": path.resolve(__dirname, "shared"),
};

// En web, redirigir react-native-worklets (runtime nativo inexistente en navegador) a un shim seguro
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-worklets") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "client/shims/react-native-worklets.js"),
    };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
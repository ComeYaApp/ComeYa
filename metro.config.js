const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

config.transformer.getTransformOptions = (() => {
  let baseOptions;
  return (_entryPoints, _options) => {
    if (!baseOptions) {
      baseOptions = {
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      };
    }
    return baseOptions;
  };
})();

config.resolver.alias = {
  "@": path.resolve(__dirname, "client"),
  "@shared": path.resolve(__dirname, "shared"),
};

config.resolver.sourceExts.push("cjs");

config.resolver.shouldTransformFile = (filePath) => {
  if (filePath.includes("node_modules") && !filePath.includes("expo-linear-gradient") && !filePath.includes("expo-file-system") && !filePath.includes("expo-modules-core")) {
    return false;
  }
  return true;
};

module.exports = config;
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Fix for import.meta error on web
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, {
  input: "./src/global.css",
});

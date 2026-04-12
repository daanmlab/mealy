module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // babel-preset-expo's hasModule('expo-router') check resolves from the root
      // node_modules, but expo-router is only in apps/mobile/node_modules in this
      // monorepo. Explicitly add the plugin to ensure EXPO_ROUTER_APP_ROOT is inlined.
      require('babel-preset-expo/build/expo-router-plugin').expoRouterBabelPlugin,
    ],
  };
};

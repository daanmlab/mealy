const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Required for Expo Router in a monorepo — tells Metro where the app/ dir is
process.env.EXPO_ROUTER_APP_ROOT ??= 'app';

const config = getDefaultConfig(projectRoot);

// Watch shared packages from the monorepo
config.watchFolders = [workspaceRoot];

// Resolve modules from both the project and workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force single copies of React and React Native to prevent version mismatch errors
// in a monorepo. extraNodeModules is only a fallback — we use resolveRequest to
// intercept ALL react requires regardless of which package is doing the requiring.
// react-native@0.81.5 ships a renderer for React 19.1.0, so we pin to that copy.
const mobileReact = path.resolve(projectRoot, 'node_modules/react');
const rootReactNative = path.resolve(workspaceRoot, 'node_modules/react-native');

const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const subPath = moduleName === 'react' ? 'index.js' : moduleName.slice('react/'.length);
    return {
      type: 'sourceFile',
      filePath: require.resolve(
        moduleName === 'react' ? mobileReact : path.join(mobileReact, subPath),
      ),
    };
  }
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [workspaceRoot] }),
    };
  }
  if (defaultResolver) return defaultResolver(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });

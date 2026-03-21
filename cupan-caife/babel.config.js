module.exports = function (api) {
  api.cache(true);
  let expoPreset = 'babel-preset-expo';

  try {
    require.resolve(expoPreset);
  } catch (error) {
    // Fall back to Expo's nested dependency so Metro can still bundle when
    // the preset was not hoisted into the project root.
    expoPreset = require.resolve('expo/node_modules/babel-preset-expo');
  }

  return {
    presets: [expoPreset],
    plugins: ['react-native-reanimated/plugin'],
  };
};

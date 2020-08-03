import createBabelConfig from './babel.config';

export const getBabelOptions = (targets, extensions) => ({
  ...createBabelConfig({ env: (env) => env === 'build' }, targets),
  extensions,
});

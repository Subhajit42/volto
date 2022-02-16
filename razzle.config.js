/* eslint no-console: 0 */
const path = require('path');
const makeLoaderFinder = require('razzle-dev-utils/makeLoaderFinder');
const nodeExternals = require('webpack-node-externals');
const LoadablePlugin = require('@loadable/webpack-plugin');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const fs = require('fs');
const RootResolverPlugin = require('./webpack-plugins/webpack-root-resolver');
const RelativeResolverPlugin = require('./webpack-plugins/webpack-relative-resolver');
const createAddonsLoader = require('./create-addons-loader');
const AddonConfigurationRegistry = require('./addon-registry');
const CircularDependencyPlugin = require('circular-dependency-plugin');

const fileLoaderFinder = makeLoaderFinder('file-loader');
const babelLoaderFinder = makeLoaderFinder('babel-loader');

const projectRootPath = path.resolve('.');
const languages = require('./src/constants/Languages');
const { poToJson } = require('@plone/scripts/i18n');

const packageJson = require(path.join(projectRootPath, 'package.json'));

const registry = new AddonConfigurationRegistry(projectRootPath);

const defaultModify = ({
  env: { target, dev },
  webpackConfig: config,
  webpackObject: webpack,
}) => {
  // Compile language JSON files from po files
  poToJson({ registry, addonMode: false });

  if (dev) {
    config.plugins.unshift(
      new webpack.DefinePlugin({
        __DEVELOPMENT__: true,
      }),
    );
  } else {
    config.plugins.unshift(
      new webpack.DefinePlugin({
        __DEVELOPMENT__: false,
      }),
    );
  }

  if (target === 'web') {
    config.plugins.unshift(
      new webpack.DefinePlugin({
        __CLIENT__: true,
        __SERVER__: false,
      }),
    );

    config.plugins.push(
      new LoadablePlugin({
        outputAsset: false,
        writeToDisk: { filename: path.resolve(`${projectRootPath}/build`) },
      }),
    );

    if (dev && process.env.DEBUG_CIRCULAR) {
      config.plugins.push(
        new CircularDependencyPlugin({
          exclude: /node_modules/,
          // `onStart` is called before the cycle detection starts
          onStart({ compilation }) {
            console.log('start detecting webpack modules cycles');
          },
          failOnError: false,
          // `onDetected` is called for each module that is cyclical
          onDetected({ module: webpackModuleRecord, paths, compilation }) {
            // `paths` will be an Array of the relative module paths that make up the cycle
            // `module` will be the module record generated by webpack that caused the cycle
            compilation.warnings.push(new Error(paths.join(' -> ')));
          },
          // `onEnd` is called before the cycle detection ends
          onEnd({ compilation }) {
            console.log(
              `Detected ${compilation.warnings.length} circular dependencies`,
            );
            compilation.warnings.forEach((item) => {
              if (item.message.includes('config')) {
                console.log(item.message);
              }
            });
          },
        }),
      );
    }

    config.output.filename = dev
      ? 'static/js/[name].js'
      : 'static/js/[name].[chunkhash:8].js';

    config.optimization = Object.assign({}, config.optimization, {
      runtimeChunk: true,
      splitChunks: {
        chunks: 'all',
        name: dev,
      },
    });

    config.plugins.unshift(
      // restrict moment.js locales to en/de
      // see https://github.com/jmblog/how-to-optimize-momentjs-with-webpack for details
      new webpack.ContextReplacementPlugin(
        /moment[/\\]locale$/,
        new RegExp(Object.keys(languages).join('|')),
      ),
      new LodashModuleReplacementPlugin({
        shorthands: true,
        cloning: true,
        currying: true,
        caching: true,
        collections: true,
        exotics: true,
        guards: true,
        metadata: true,
        deburring: true,
        unicode: true,
        chaining: true,
        memoizing: true,
        coercions: true,
        flattening: true,
        paths: true,
        placeholders: true,
      }),
    );
  }

  if (target === 'node') {
    config.plugins.unshift(
      new webpack.DefinePlugin({
        __CLIENT__: false,
        __SERVER__: true,
      }),
    );

    // Razzle sets some of its basic env vars in the default config injecting them (for
    // the client use, mainly) in a `DefinePlugin` instance. However, this also ends in
    // the server build, removing the ability of the server node process to read from
    // the system's (or process') env vars. In this case, in the server build, we hunt
    // down the instance of the `DefinePlugin` defined by Razzle and remove the
    // `process.env.PORT` so it can be overridable in runtime
    const idxArr = config.plugins
      .map((plugin, idx) =>
        plugin.constructor.name === 'DefinePlugin' ? idx : '',
      )
      .filter(String);
    idxArr.forEach((index) => {
      const { definitions } = config.plugins[index];
      if (definitions['process.env.PORT']) {
        const newDefs = Object.assign({}, definitions);
        // Transforms the stock RAZZLE_PUBLIC_DIR into relative path,
        // so one can move the build around
        newDefs['process.env.RAZZLE_PUBLIC_DIR'] = newDefs[
          'process.env.RAZZLE_PUBLIC_DIR'
        ].replace(projectRootPath, '.');
        // Handles the PORT, so it takes the real PORT from the runtime enviroment var,
        // but keeps the one from build time, if different from 3000 (by not deleting it)
        // So build time one takes precedence, do not set it in build time if you want
        // to control it always via runtime (assumming 3000 === not set in build time)
        if (newDefs['process.env.PORT'] === '3000') {
          delete newDefs['process.env.PORT'];
        }
        config.plugins[index] = new webpack.DefinePlugin(newDefs);
      }
    });
  }

  // Don't load config|variables|overrides) files with file-loader
  // Don't load SVGs from ./src/icons with file-loader
  const fileLoader = config.module.rules.find(fileLoaderFinder);
  fileLoader.exclude = [
    /\.(config|variables|overrides)$/,
    /icons\/.*\.svg$/,
    ...fileLoader.exclude,
  ];

  // Disabling the ESlint pre loader
  config.module.rules.splice(0, 1);

  let testingAddons = [];
  if (process.env.RAZZLE_TESTING_ADDONS) {
    testingAddons = process.env.RAZZLE_TESTING_ADDONS.split(',');
  }

  const addonsLoaderPath = createAddonsLoader(
    [...registry.getAddonDependencies(), ...testingAddons],
    registry.packages,
  );

  config.resolve.plugins = [
    new RelativeResolverPlugin(registry),
    new RootResolverPlugin(),
  ];

  config.resolve.alias = {
    ...registry.getTestingAddonCustomizationPaths(),
    ...registry.getAddonCustomizationPaths(),
    ...registry.getProjectCustomizationPaths(),
    ...config.resolve.alias,
    '../../theme.config$': `${projectRootPath}/theme/theme.config`,
    'volto-themes': `${registry.voltoPath}/theme/themes`,
    'load-volto-addons': addonsLoaderPath,
    ...registry.getResolveAliases(),
    '@plone/volto': `${registry.voltoPath}/src`,
    // to be able to reference path uncustomized by webpack
    '@plone/volto-original': `${registry.voltoPath}/src`,
    // be able to reference current package from customized package
    '@package': `${projectRootPath}/src`,
    // we're incorporating redux-connect
    'redux-connect': `${registry.voltoPath}/src/helpers/AsyncConnect`,
  };

  config.performance = {
    maxAssetSize: 10000000,
    maxEntrypointSize: 10000000,
  };

  let addonsAsExternals = [];

  const babelLoader = config.module.rules.find(babelLoaderFinder);
  const { include } = babelLoader;
  if (packageJson.name !== '@plone/volto') {
    include.push(fs.realpathSync(`${registry.voltoPath}/src`));
  }
  // Add babel support external (ie. node_modules npm published packages)
  if (registry.addonNames && registry.addonNames.length > 0) {
    registry.addonNames.forEach((addon) => {
      const p = fs.realpathSync(registry.packages[addon].modulePath);
      if (include.indexOf(p) === -1) {
        include.push(p);
      }
    });
    addonsAsExternals = registry.addonNames.map((addon) => new RegExp(addon));
  }

  if (process.env.RAZZLE_TESTING_ADDONS) {
    testingAddons.forEach((addon) => {
      const normalizedAddonName = addon.split(':')[0];
      const p = fs.realpathSync(
        registry.packages[normalizedAddonName].modulePath,
      );
      if (include.indexOf(p) === -1) {
        include.push(p);
      }
      addonsAsExternals = registry.addonNames.map(
        (normalizedAddonName) => new RegExp(normalizedAddonName),
      );
    });
  }

  config.externals =
    target === 'node'
      ? [
          nodeExternals({
            whitelist: [
              dev ? 'webpack/hot/poll?300' : null,
              /\.(eot|woff|woff2|ttf|otf)$/,
              /\.(svg|png|jpg|jpeg|gif|ico)$/,
              /\.(mp4|mp3|ogg|swf|webp)$/,
              /\.(css|scss|sass|sss|less)$/,
              // Add support for whitelist external (ie. node_modules npm published packages)
              ...addonsAsExternals,
              /^@plone\/volto/,
            ].filter(Boolean),
          }),
        ]
      : [];
  return config;
};

const addonExtenders = registry.getAddonExtenders().map((m) => require(m));

const defaultPlugins = [
  { object: require('./webpack-plugins/webpack-less-plugin')({ registry }) },
  { object: require('./webpack-plugins/webpack-sentry-plugin') },
  { object: require('./webpack-plugins/webpack-svg-plugin') },
  { object: require('./webpack-plugins/webpack-bundle-analyze-plugin') },
  { object: require('./jest-extender-plugin') },
];

const plugins = addonExtenders.reduce(
  (acc, extender) => extender.plugins(acc),
  defaultPlugins,
);

module.exports = {
  plugins,
  modifyWebpackConfig: ({
    env: { target, dev },
    webpackConfig,
    webpackObject,
  }) => {
    const defaultConfig = defaultModify({
      env: { target, dev },
      webpackConfig,
      webpackObject,
    });
    const res = addonExtenders.reduce(
      (acc, extender) => extender.modify(acc, { target, dev }, webpackConfig),
      defaultConfig,
    );
    return res;
  },
  experimental: {
    reactRefresh: true,
  },
};

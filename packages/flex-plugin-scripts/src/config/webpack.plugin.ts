import webpackBaseFactory from './webpack.base';
import { paths } from 'flex-dev-utils';
import ModuleScopePlugin from '@k88/module-scope-plugin';
import typescriptFormatter from '@k88/typescript-compile-error-formatter';
import { Environment } from 'flex-dev-utils/dist/env';
import { resolveModulePath } from 'flex-dev-utils/dist/require';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import PnpWebpackPlugin from 'pnp-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import webpack, {
  Loader,
  Plugin,
  Resolve,
  SourceMapDevToolPlugin,
} from 'webpack';

import Optimization = webpack.Options.Optimization;

interface LoaderOption { [name: string]: any }

const IMAGE_SIZE_BYTE = 10 * 1024;
const FLEX_SHIM = 'flex-plugin-scripts/dev_assets/flex-shim.js';

/**
 * Returns the Babel Loader configuration
 * @param isProd  whether this is a production build
 */
const _getBabelLoader = (isProd: boolean) => ({
  test: new RegExp('\.(' + paths.extensions.join('|') + ')$'),
  include: paths.app.srcDir,
  loader: require.resolve('babel-loader'),
  options: {
    customize: require.resolve('babel-preset-react-app/webpack-overrides'),
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-react-app')],
    plugins: [
      [
        require.resolve('babel-plugin-named-asset-import'),
        {
          loaderMap: {
            svg: { ReactComponent: '@svgr/webpack?-svgo,+titleProp,+ref![path]' },
          },
        },
      ],
    ],
    compact: isProd,
  },
});

/**
 * Gets the image loader
 * @private
 */
export const _getImageLoader = () => ({
    test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
    loader: require.resolve('url-loader'),
    options: {
      limit: IMAGE_SIZE_BYTE,
    },
});

/**
 * Gets the styles loader
 * @param isProd  whether this is a production build
 * @private
 */
export const _getStyleLoaders = (isProd: boolean) => {
  /**
   * Gets the loader for the given style
   * @param options the options
   * @param preProcessor  the pre-processor, for example scss-loader
   * @param implementation  the implementation for thr scss-loader
   */
  const getStyleLoader = (options: LoaderOption, preProcessor?: string, implementation?: string) => {
    const loaders: Loader[] = [];

    // This is for hot-reloading to work
    if (!isProd) {
      loaders.push(require.resolve('style-loader'));
    }

    // All css loader
    loaders.push(
      {
        loader: require.resolve('css-loader'),
        options,
      },
      {
        loader: require.resolve('postcss-loader'),
        options: {
          ident: 'postcss',
          plugins: () => [
            require('postcss-flexbugs-fixes'),
            require('postcss-preset-env')({
              autoprefixer: {
                flexbox: 'no-2009',
              },
              stage: 3,
            }),
          ],
          sourceMap: isProd,
        },
      }
    );

    // Add a pre-processor loader (converting SCSS to CSS)
    if (preProcessor) {
      const preProcessorOptions: Record<string, any> = {
        sourceMap: isProd,
      };

      if (implementation) {
        const nodePath = resolveModulePath(implementation);
        if (nodePath) {
          preProcessorOptions.implementation = require(nodePath);
        }
      }

      loaders.push(
        {
          loader: require.resolve('resolve-url-loader'),
          options: {
            sourceMap: isProd,
          },
        },
        {
          loader: require.resolve(preProcessor),
          options: preProcessorOptions,
        }
      );
    }

    return loaders;
  };

  return [
    {
      test: /\.css$/,
      exclude: /\.module\.css$/,
      use: getStyleLoader( {
        importLoaders: 1,
        sourceMap: isProd,
      }),
      sideEffects: true,
    },
    {
      test: /\.module\.css$/,
      use: getStyleLoader({
        importLoaders: 1,
        sourceMap: isProd,
        modules: true
      }),
    },
    {
      test: /\.(scss|sass)$/,
      exclude: /\.module\.(scss|sass)$/,
      use: getStyleLoader(
        {
          importLoaders: 3,
          sourceMap: isProd,
        },
        'sass-loader',
        'node-sass',
      ),
      sideEffects: true,
    },
    {
      test: /\.module\.(scss|sass)$/,
      use: getStyleLoader(
        {
          importLoaders: 3,
          sourceMap: isProd,
          modules: true,
        },
        'sass-loader',
        'node-sass',
      ),
    },
  ];
};

/**
 * Returns an array of {@link Plugin} for Webpack
 * @param env the environment
 * @private
 */
export const _getPlugins = (env: Environment): Plugin[] => {
  const plugins: Plugin[] = [];
  const isDev = env === Environment.Development;
  const isProd = env === Environment.Production;

  if (env === Environment.Production) {
    plugins.push(new SourceMapDevToolPlugin({
      append: '\n//# sourceMappingURL=bundle.js.map',
    }));
  }
  const hasPnp = 'pnp' in process.versions;

  if (paths.app.isTSProject()) {
    const typescriptPath = resolveModulePath('typescript');
    const config: Partial<ForkTsCheckerWebpackPlugin.Options> = {
      typescript: typescriptPath || undefined,
      async: isDev,
      useTypescriptIncrementalApi: true,
      checkSyntacticErrors: true,
      resolveModuleNameModule: hasPnp
        ? `${__dirname}/webpack/pnpTs.js`
        : undefined,
      resolveTypeReferenceDirectiveModule: hasPnp
        ? `${__dirname}/webpack/pnpTs.js`
        : undefined,
      tsconfig: paths.app.tsConfigPath,
      reportFiles: [
        '**',
        '!**/__tests__/**',
        '!**/__mocks__/**',
        '!**/?(*.)(spec|test).*',
        '!**/src/setupProxy.*',
        '!**/src/setupTests.*',
      ],
      silent: true,
    };
    if (isProd) {
      config.formatter = typescriptFormatter
    }

    plugins.push(new ForkTsCheckerWebpackPlugin(config));
  }

  return plugins;
};

/**
 * Returns the `entry` key of the webpack
 * @param env the environment
 * @private
 */
export const _getEntries = (env: Environment): string[] => {
  // this is specifically only for the javascirpt bundle
  const entry: string[] = [];

  if (env === Environment.Development) {
    entry.push(
      require.resolve('@k88/cra-webpack-hot-dev-client/build'),
    );
  }

  entry.push(paths.app.entryPath);

  return entry;
};

/**
 * Returns the `optimization` key of webpack
 * @param env the environment
 * @private
 */
export const _getOptimization = (env: Environment): Optimization => {
  const isProd = env === Environment.Production;
  return {
    splitChunks: false,
    runtimeChunk: false,
    minimize: isProd,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
          },
          mangle: {
            safari10: true,
          },
          keep_classnames: isProd,
          keep_fnames: isProd,
          output: {
            ecma: 5,
            comments: false,
            ascii_only: true,
          },
        },
        sourceMap: true,
      }),
    ],
  };
};

/**
 * Returns the `resolve` key of webpack
 * @param env the environment
 * @private
 */
export const _getResolve = (env: Environment): Resolve => {
  const isProd = env === Environment.Production;
  const extensions = !paths.app.isTSProject()
    ? paths.extensions.filter(e => !e.includes('ts'))
    : paths.extensions;

  const resolve: Resolve = {
    modules: ['node_modules', paths.app.nodeModulesDir],
    extensions: extensions.map(e => `.${e}`),
    alias: {
      '@twilio/flex-ui': FLEX_SHIM,
    },
    plugins: [
      PnpWebpackPlugin,
      new ModuleScopePlugin(paths.app.srcDir, [paths.app.pkgPath]),
    ]
  };

  if (isProd && resolve.alias) {
    resolve.alias['scheduler/tracing'] = 'scheduler/tracing-profiling';
  }

  return resolve;
};

/**
 * Main method for generating a webpack configuration
 * @param env
 */
export default (env: Environment) => {
  const isProd = env === Environment.Production;
  const config = webpackBaseFactory(env);

  config.plugins = config.plugins ? config.plugins : [];
  config.plugins.push(..._getPlugins(env));
  config.entry = _getEntries(env);
  config.output = {
    path: paths.app.buildDir, // the output directories absolute path
    pathinfo: !isProd,
    futureEmitAssets: true,
    filename: `${paths.app.name}.js`,
    publicPath: paths.app.publicDir, // the link itself for the host
    globalObject: 'this',
  };
  config.bail = isProd;
  config.devtool = 'hidden-source-map';
  config.node = {
    module: 'empty',
    dgram: 'empty',
    dns: 'mock',
    fs: 'empty',
    http2: 'empty',
    net: 'empty',
    tls: 'empty',
    child_process: 'empty',
  };
  config.resolve = _getResolve(env);
  config.resolveLoader = {
    plugins: [
      PnpWebpackPlugin.moduleLoader(module),
    ]
  };
  config.module = {
    strictExportPresence: true,
    rules: [
      { parser: { requireEnsure: false } },
      {
        oneOf: [
          _getImageLoader(),
          _getBabelLoader(isProd),
          ..._getStyleLoaders(isProd),
        ]
      },
    ]
  };

  return config;
};

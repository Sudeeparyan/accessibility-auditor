/**
 * webpack.config.js — Webpack configuration for Serverless Framework
 *
 * Bundles TypeScript Lambda handlers for deployment. Uses ts-loader
 * for TypeScript compilation and excludes node_modules that are
 * packaged separately by serverless-webpack.
 */

const path = require('path');
const slsw = require('serverless-webpack');

module.exports = {
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  entry: slsw.lib.entries,
  target: 'node',
  devtool: 'source-map',

  resolve: {
    extensions: ['.ts', '.js', '.json'],
    alias: {
      '@services': path.resolve(__dirname, 'src/services'),
      '@handlers': path.resolve(__dirname, 'src/handlers'),
      '@analyzer': path.resolve(__dirname, 'src/analyzer'),
      '@scraper': path.resolve(__dirname, 'src/scraper'),
      '@orchestrator': path.resolve(__dirname, 'src/orchestrator'),
    },
  },

  output: {
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true, // Faster builds; type checking via tsc separately
        },
      },
    ],
  },

  externals: [
    // Stock puppeteer not used in Lambda — we use puppeteer-core + @sparticuz/chromium
    'puppeteer',
    // @sparticuz/chromium must be external so its binary files in bin/ are preserved
    '@sparticuz/chromium',
    // axe-core must be external so require.resolve returns a real path for fs.readFileSync
    'axe-core',
  ],

  optimization: {
    minimize: true,
  },
};

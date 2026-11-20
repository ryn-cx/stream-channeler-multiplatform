// TODO: Validate
const path = require("node:path");
const { merge } = require("webpack-merge");
const LiveReloadPlugin = require("webpack-livereload-plugin");
const { UserScriptMetaDataPlugin } = require("userscript-metadata-webpack-plugin");

const baseMetadata = require("./metadata.cjs");
const webpackConfig = require("./webpack.config.base.cjs");

const metadata = structuredClone(baseMetadata);

// The development copy loads the build from disk. Without these removed, it would update itself to the newest release.
delete metadata.updateURL;
delete metadata.downloadURL;
metadata.require = [`file://${path.resolve(__dirname, "../dist/stream-channeler.debug.js")}`];

const cfg = merge(webpackConfig, {
  mode: "development",
  cache: {
    type: "filesystem",
    name: "dev",
  },
  entry: {
    debug: webpackConfig.entry,
    "dev.user": path.resolve(__dirname, "./empty.cjs"),
  },
  output: {
    filename: "stream-channeler.[name].js",
    path: path.resolve(__dirname, "../dist"),
  },
  devtool: "eval-source-map",
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
  },
  plugins: [
    new LiveReloadPlugin({
      delay: 500,
    }),
    new UserScriptMetaDataPlugin({
      metadata,
    }),
  ],
});

module.exports = cfg;

// TODO: Validate
const path = require("node:path");

const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

const webpackConfig = {
  resolve: {
    extensions: [".js", ".ts"],
  },
  optimization: {
    minimize: false,
    moduleIds: "named",
  },
  entry: path.resolve(__dirname, "../src/index.ts"),
  output: {
    path: path.resolve(__dirname, "../dist"),
  },
  target: "web",
  performance: {
    hints: false,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "esbuild-loader",
        options: {
          target: "es2022",
        },
      },
      {
        test: /\.css$/,
        loader: "css-loader",
        options: {
          exportType: "string",
          url: false,
        },
      },
      {
        test: /\.svg$/,
        type: "asset/inline",
      },
    ],
  },
  plugins: process.env.npm_config_report ? [new BundleAnalyzerPlugin()] : [],
};

module.exports = webpackConfig;

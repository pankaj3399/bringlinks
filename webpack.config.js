const path = require("path");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  // Entry point for your application (compiled by tsc)
  entry: "./dist/server.js",

  // Target Node.js (since this is a backend project)
  target: "node",

  // Avoid bundling node_modules dependencies
  externals: [nodeExternals()],

  // Define the mode (development or production)
  mode: process.env.NODE_ENV === "production" ? "production" : "development",

  // Output settings
  output: {
    filename: "bundle.js", // Output file name
    path: path.resolve(__dirname, "dist"), // Output directory (dist)
  },

  // Source maps for easier debugging in development
  devtool:
    process.env.NODE_ENV === "production" ? "source-map" : "inline-source-map",

  // Resolve .js and .ts files
  resolve: {
    extensions: [".js", ".ts"],
  },

  // Optimization settings (optional for server-side)
  optimization: {
    minimize: process.env.NODE_ENV === "production", // Minify only in production
  },
};

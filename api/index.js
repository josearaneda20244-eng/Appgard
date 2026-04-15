const path = require("path");
  const { pathToFileURL } = require("url");

  let appPromise;

  module.exports = async function handler(req, res) {
    if (!appPromise) {
      const distPath = path.resolve(
        __dirname,
        "..",
        "imported",
        "Appgard",
        "artifacts",
        "api-server",
        "dist",
        "index.mjs"
      );
      appPromise = import(pathToFileURL(distPath).href).then(
        (mod) => mod.default ?? mod
      );
    }
    const app = await appPromise;
    return app(req, res);
  };
  
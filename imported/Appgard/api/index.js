let appPromise;

module.exports = async function handler(req, res) {
  if (!appPromise) {
    appPromise = import("../artifacts/api-server/dist/index.mjs").then((mod) => mod.default ?? mod);
  }

  const app = await appPromise;
  return app(req, res);
};

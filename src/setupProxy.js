// CRA dev proxy: only forward Netlify function calls to the local backend.
// Without this, the catch-all "proxy" in package.json forwards ALL unmatched
// requests (including /favicon.ico, static assets, etc.) to localhost:8888,
// causing ECONNREFUSED noise when that server isn't running.
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/.netlify/functions",
    createProxyMiddleware({
      target: "http://localhost:8888",
      changeOrigin: true,
    })
  );
};

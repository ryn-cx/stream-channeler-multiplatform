// TODO: Validate
const { description, version } = require("../package.json");
const streamingSiteHosts = require("./streaming-site-hosts.cjs");

module.exports = {
  name: "Stream Channeler",
  namespace: "https://streamchanneler.com/",
  version,
  description,
  author: "ryn-cx",
  license: "AGPL-3.0-only",
  homepageURL: "https://github.com/ryn-cx/stream-channeler-multiplatform",
  supportURL: "https://github.com/ryn-cx/stream-channeler-multiplatform/issues",
  // The release workflow attaches the built userscript to each GitHub release, so these addresses always serve the
  // newest release and installed copies update from them.
  updateURL:
    "https://github.com/ryn-cx/stream-channeler-multiplatform/releases/latest/download/stream-channeler.user.js",
  downloadURL:
    "https://github.com/ryn-cx/stream-channeler-multiplatform/releases/latest/download/stream-channeler.user.js",
  icon: "https://streamchanneler.com/assets/images/stream-channeler-icon.png",
  match: [
    "https://streamchanneler.com/*",
    ...streamingSiteHosts.map((streamingSiteHost) => `https://*.${streamingSiteHost}/*`),
  ],
  grant: [
    "GM.getValue",
    "GM.setValue",
    "GM.deleteValue",
    "GM.xmlHttpRequest",
    "GM_addValueChangeListener",
    "GM_removeValueChangeListener",
    "GM_registerMenuCommand",
    "GM_unregisterMenuCommand",
  ],
  // Channel logos are read through GM.xmlHttpRequest so the guide can sample their pixels, and a channel's logo can be
  // on any host. A narrower list would stop the guide from putting a light background behind dark logos on other hosts.
  connect: ["*"],
  "run-at": "document-start",
};

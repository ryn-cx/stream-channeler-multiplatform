// TODO: Validate

import { StreamChannelerApp } from "../../stream-channeler-app";
import { takeOverPage } from "../../userscript/userscript-pages";

// TODO: Validate
export async function startGuidePage(): Promise<void> {
  const guidePageBody = takeOverPage("Stream Channeler Guide", null);
  const appRoot = document.createElement("div");
  appRoot.id = "app";
  guidePageBody.append(appRoot);
  window.addEventListener("pageshow", (pageShowEvent) => {
    if (pageShowEvent.persisted) window.location.reload();
  });
  const streamChannelerApp = await StreamChannelerApp.create(appRoot);
  streamChannelerApp.start();
}

import { createTutorial } from "@boardgamers/protocol/tutorial";
import { mountTutorialGuide } from "@boardgamers/protocol/tutorial/dom";
import { stripSecret } from "../engine/index.js";
import { chapters } from "./tutorials.js";
import { mountGame } from "./ui.js";
export async function mountLesson(target, options) {
  const config = chapters[options.chapter];
  if (!config) throw Error("Unknown chapter");
  let storage;
  try {
    storage = window.localStorage;
  } catch {}
  const tutorial = await createTutorial({
    ...config,
    storage,
    onProgress: options.onProgress,
  });
  const guide = document.createElement("div");
  guide.className = "vanuatu-tutorial";
  target.append(guide);
  const ui = mountGame(target, {
    language: options.locale ?? "en",
    onMove: async (m) => {
      const accepted = await tutorial.play(m);
      if (!accepted)
        throw Error(
          tutorial.snapshot.error ||
            tutorial.snapshot.feedback ||
            "Try the action described in this step.",
        );
    },
  });
  if (options.locale) ui.setPreferences({ locale: options.locale });
  ui.setPlayer(0);
  const off = tutorial.subscribe((snapshot) => {
    ui.render(stripSecret(snapshot.state, 0));
    ui.setEnabled(
      !snapshot.busy && !snapshot.completed && !snapshot.canContinue,
    );
  });
  const unmount = mountTutorialGuide(guide, tutorial, {
    nextChapter: options.nextChapter,
  });
  return () => {
    off();
    unmount();
    tutorial.destroy();
    ui.destroy();
    guide.remove();
  };
}

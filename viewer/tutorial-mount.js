import { createTutorial } from "@boardgamers/protocol/tutorial";
import { mountTutorialGuide } from "@boardgamers/protocol/tutorial/dom";
import { stripSecret } from "../engine/index.js";
import { chapters } from "./tutorials.js";
import { icon } from "./art.js";
import { pictogramText } from "./prose.js";
import { translateText } from "./localization/index.js";
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
  let errorFrame;
  const ui = mountGame(target, {
    language: options.locale ?? "en",
    onMove: async (m) => {
      const accepted = await tutorial.play(m);
      if (!accepted) {
        cancelAnimationFrame(errorFrame);
        errorFrame = requestAnimationFrame(() => {
          const error = guide.querySelector('[role="alert"]:not([hidden])');
          if (!error) return;
          const bounds = error.getBoundingClientRect();
          if (bounds.top < 0 || bounds.bottom > window.innerHeight)
            window.scrollBy({ top: bounds.top - 16, behavior: "instant" });
        });
      }
      return accepted;
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
  // The protocol owns the guide and navigation. Format its authored paragraphs
  // after each snapshot; no DOM observer or changes to the board are needed.
  const paragraphs = guide.querySelectorAll(
    ".bgs-tutorial-body > p:nth-child(-n+2)",
  );
  for (const paragraph of paragraphs) paragraph.setAttribute("translate", "no");
  const error = guide.querySelector('[role="alert"]');
  error.setAttribute("translate", "no");
  error.classList.add("tutorial-error");
  const offProse = tutorial.subscribe((snapshot) => {
    [snapshot.text, snapshot.hint].forEach((source, i) => {
      const paragraph = paragraphs[i];
      if (!paragraph || !source) return;
      paragraph.innerHTML = pictogramText(
        translateText(source, options.locale),
        options.locale,
      );
    });
    // Validators often return the current instruction. Show it once, as the
    // inline correction, instead of repeating it and adding a floating toast.
    paragraphs[0].hidden =
      !!snapshot.error && snapshot.error.trim() === snapshot.text.trim();
    if (snapshot.error) {
      error.innerHTML = `${icon("warning", "")}<span>${pictogramText(translateText(snapshot.error, options.locale), options.locale)}</span>`;
      guide.querySelector(".bgs-tutorial-body").hidden = false;
      const collapse = guide.querySelector(".bgs-tutorial-heading button");
      collapse.setAttribute("aria-expanded", "true");
      collapse.textContent = translateText("Hide", options.locale);
    }
  });
  return () => {
    cancelAnimationFrame(errorFrame);
    offProse();
    off();
    unmount();
    tutorial.destroy();
    ui.destroy();
    guide.remove();
  };
}

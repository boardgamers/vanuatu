import { mountLesson } from "./tutorial-mount.js";
import "./style.css";
import * as engine from "../engine/index.js";
import { mountGame } from "./ui.js";
const params = new URLSearchParams(location.search);
if (params.has("lesson")) {
  const names = ["planning", "fishing", "islands"];
  const chapter = params.get("lesson");
  const next = names[names.indexOf(chapter) + 1];
  await mountLesson(document.querySelector("#game"), {
    chapter,
    nextChapter: next
      ? {
          title: next,
          open: () => {
            location.search = "?lesson=" + next;
          },
        }
      : undefined,
  });
} else {
  const count = Math.max(2, Math.min(5, Number(params.get("players") ?? 3)));
  let state,
    hotseat = params.has("hotseat"),
    timer;
  const storageKey = "vanuatu-practice-v1";
  try {
    if (!params.has("new"))
      state = JSON.parse(localStorage.getItem(storageKey));
  } catch {}
  if (!state?.version)
    state = engine.init(
      count,
      params.has("water") ? ["rising-waters"] : [],
      {},
      params.get("seed") ?? "island-breeze",
    );
  state.players.forEach(
    (p, i) => (p.name = ["You", "Maya", "Noa", "Leo", "Nina"][i]),
  );
  const control = document.createElement("div");
  control.className = "preview-controls";
  control.innerHTML =
    '<span>Local practice</span><button data-new>New game</button><label><input type="checkbox" data-hotseat> Every seat</label><button data-step>Bot move</button><button data-auto>Autoplay</button><label>Players <select data-count><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label><label><input type="checkbox" data-water> Rising Waters</label>';
  document.body.prepend(control);
  control.querySelector("[data-count]").value = state.players.length;
  control.querySelector("[data-water]").checked = state.options.risingWaters;
  control.querySelector("[data-hotseat]").checked = hotseat;
  const ui = mountGame(document.querySelector("#game"), {
    onMove: (m) => {
      state = engine.move(state, m, hotseat ? state.actor : 0);
      save();
      show();
      scheduleBots();
    },
    onPreference: (name, value) => {
      preferences[name] = value;
      localStorage.setItem("vanuatu-preferences", JSON.stringify(preferences));
      ui.setPreferences(preferences);
    },
  });
  let preferences = {};
  try {
    preferences = JSON.parse(localStorage.getItem("vanuatu-preferences")) ?? {};
  } catch {}
  ui.setPreferences(preferences);
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }
  function show() {
    const p = hotseat ? state.actor : 0;
    ui.setPlayer(p);
    ui.render(engine.stripSecret(state, p));
  }
  function scheduleBots() {
    clearTimeout(timer);
    if (!hotseat && !state.finished && state.actor !== 0)
      timer = setTimeout(() => {
        state = engine.moveAI(state, state.actor);
        save();
        show();
        scheduleBots();
      }, 450);
  }
  function bot() {
    if (state.finished) return;
    state = engine.moveAI(state, state.actor);
    save();
    show();
    scheduleBots();
  }
  control.querySelector("[data-new]").onclick = () => {
    clearTimeout(timer);
    state = engine.init(
      Number(control.querySelector("[data-count]").value),
      control.querySelector("[data-water]").checked ? ["rising-waters"] : [],
      {},
      crypto.randomUUID(),
    );
    state.players.forEach(
      (p, i) => (p.name = ["You", "Maya", "Noa", "Leo", "Nina"][i]),
    );
    save();
    show();
    scheduleBots();
  };
  control.querySelector("[data-hotseat]").onchange = (e) => {
    hotseat = e.target.checked;
    show();
    scheduleBots();
  };
  control.querySelector("[data-step]").onclick = bot;
  let autoplay = false;
  control.querySelector("[data-auto]").onclick = async (e) => {
    autoplay = !autoplay;
    e.target.textContent = autoplay ? "Stop" : "Autoplay";
    while (autoplay && !state.finished) {
      clearTimeout(timer);
      state = engine.moveAI(state, state.actor);
      save();
      show();
      await new Promise((r) => setTimeout(r, 160));
    }
    autoplay = false;
    e.target.textContent = "Autoplay";
  };
  window.vanuatuDemo = {
    get state() {
      return state;
    },
    setState(s) {
      state = s;
      show();
    },
    engine,
    ui,
  };
  show();
  scheduleBots();
}

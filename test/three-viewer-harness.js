import * as engine from "../engine/index.js";

let host,
  state,
  preferences = { locale: "fr", sound: false, mapView: "3d" },
  updates = [];
const root = document.querySelector("#game"),
  status = document.querySelector("#status");
const params = new URLSearchParams(location.search);
if (params.has("saved"))
  preferences =
    JSON.parse(localStorage.getItem("qa-bgs-preferences")) ?? preferences;
function fixture() {
  const s = engine.init(3, [], {}, "hosted-3d-release");
  s.phase = "actions";
  s.actor = s.first = 0;
  s.players.forEach((p) => {
    p.character = null;
    p.markers = Object.fromEntries(engine.ACTIONS.map((a) => [a, 0]));
  });
  s.players[0].markers.buy = 1;
  s.players[0].money = 3;
  s.players[0].boat = "1,0";
  s.board["0,0"].goods = { kava: 0, copra: 0, beef: 1 };
  s.demands[0] = {
    id: 101,
    goods: ["kava", "copra", "beef"],
    filled: [true, true, false],
  };
  return s;
}
function report() {
  status.textContent = JSON.stringify({
    preferences,
    updates,
    round: state.round,
    phase: state.phase,
  });
}
function show() {
  host.emit("state", engine.stripSecret(state, 0));
  report();
}
function launch() {
  host = window.vanuatu.launch("#game");
  host.on("update:preference", (value) => {
    updates.push(value);
    preferences = { ...preferences, [value.name]: value.value };
    localStorage.setItem("qa-bgs-preferences", JSON.stringify(preferences));
    host.emit("preferences", preferences);
    report();
  });
  host.on("move", (move) => {
    state = engine.move(state, move, 0);
    show();
  });
  host.emit("player", { index: 0 });
  host.emit("preferences", preferences);
  show();
}
document.querySelector("[data-reset]").onclick = () => {
  state = fixture();
  show();
};
document.querySelector("[data-export]").onclick = () => {
  const move = engine
    .availableMoves(state)
    .find(
      (m) =>
        m.type === "act" && m.action === "buy" && m.good === "beef" && !m.bonus,
    );
  if (move) {
    state = engine.move(state, move, 0);
    show();
  }
};
document.querySelector("[data-remote]").onclick = () => {
  preferences = {
    ...preferences,
    mapView: preferences.mapView === "3d" ? "2d" : "3d",
  };
  host.emit("preferences", preferences);
  report();
};
document.querySelector("[data-german]").onclick = () => {
  preferences = { ...preferences, locale: "de" };
  host.emit("preferences", preferences);
  report();
};
document.querySelector("[data-place]").onclick = () => {
  const move = engine.availableMoves(state).find((m) => m.type === "place");
  if (move) {
    state = engine.move(state, move, state.actor);
    show();
  }
};
if (params.has("no-webgl")) {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    return kind.startsWith("webgl")
      ? null
      : getContext.call(this, kind, ...args);
  };
}
state = fixture();
launch();

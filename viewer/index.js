import { mountLocalization, localizeTutorial } from "./localization/index.js";
import { mountLesson } from "./tutorial-mount.js";
import "./style.css";
import { registerViewer } from "@boardgamers/protocol/viewer";
import { ChatController } from "@boardgamers/protocol/chat";
import { mountGame } from "./ui.js";
import {
  createBoardThumbnail,
  installPlayerCards,
} from "./host-presentation.js";
registerViewer(
  "vanuatu",
  (ctx) => {
    const localization = mountLocalization(ctx.target);
    const chat = new ChatController();
    let live,
      replaying = false,
      position = 1,
      pending,
      timeout;
    const ui = mountGame(ctx.target, {
      chat,
      onOpenPlayer: ctx.openPlayer,
      onOpenBoardgame: ctx.openBoardgame,
      onPreference: ctx.updatePreference,
      onMove: (m) =>
        new Promise((resolve, reject) => {
          pending = { resolve, reject };
          timeout = setTimeout(() => {
            pending = undefined;
            reject(
              Error(
                "Waiting for the server. Please refresh if your move has not appeared.",
              ),
            );
          }, 15000);
          ctx.move(m);
        }),
    });
    const thumbnail = createBoardThumbnail(ctx.target),
      removeCards = installPlayerCards(ctx.target, ctx);
    function info() {
      if (live)
        ctx.setReplayInfo({
          start: 1,
          current: position,
          end: live.historyLength,
        });
    }
    function seek(index) {
      if (!live) return;
      position = Math.max(1, Math.min(live.historyLength, index));
      ctx.fetchLog({ start: position - 1, end: position - 1 });
      info();
    }
    return {
      chat,
      onState(state) {
        localization.setState(state);
        live = state;
        if (!replaying) {
          position = state.historyLength;
          ui.render(state);
          ui.setEnabled(true);
        }
        info();
        if (pending) {
          clearTimeout(timeout);
          pending.resolve();
          pending = undefined;
        }
      },
      onPlayer(p) {
        ui.setPlayer(p.index);
      },
      onPreferences(p) {
        localization.setLocale(p.locale ?? p.language);
        ui.setPreferences(p);
      },
      onAvatars() {},
      onError(e) {
        clearTimeout(timeout);
        pending?.reject(e);
        pending = undefined;
      },
      onLog(log) {
        if (!replaying) return;
        const data = log.data;
        if (data?.frames?.length && log.start === position - 1) {
          ui.render({ ...data.frames[0], legal: [], historyLength: position });
          ui.setEnabled(false);
        }
      },
      onReplayStart() {
        replaying = true;
        ui.setEnabled(false);
        seek(live?.historyLength ?? 1);
      },
      onReplayTo(index) {
        replaying = true;
        seek(index);
      },
      onReplayEnd() {
        replaying = false;
        ui.setEnabled(true);
        if (live) {
          position = live.historyLength;
          ui.render(live);
          info();
        }
        ctx.fetchState();
      },
      onThumbnail: (size) =>
        thumbnail.render(
          ctx.target.querySelector(".archipelago"),
          size,
          "#8bcbd4",
        ),
      destroy() {
        localization.destroy();
        clearTimeout(timeout);
        pending?.resolve();
        removeCards();
        thumbnail.destroy();
        ui.destroy();
      },
    };
  },
  { tutorial: localizeTutorial(mountLesson) },
);

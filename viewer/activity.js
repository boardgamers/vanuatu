import { mountChat } from "@boardgamers/protocol/chat/dom";
import { icon, token, esc } from "./art.js";
import { translator } from "./labels.js";
import { CHARACTERS } from "../engine/catalog.js";
export function mountActivity(
  target,
  { chat, openPlayer, onBack, language = "en" } = {},
) {
  const root = document.createElement("section");
  root.className = "activity";
  root.innerHTML = `<header><div role="tablist"><button type="button" role="tab" data-tab="journal">${icon("journal")} <span>Journal</span></button><button type="button" role="tab" data-tab="chat" ${chat ? "" : "hidden"}>${icon("chat")} <span>Chat</span> <b class="unread" hidden></b></button></div><button type="button" class="text-button" data-back>↑ <span>Board</span></button></header><div class="journal-panel" role="tabpanel"><ol class="event-list" tabindex="0"></ol></div><div class="chat-panel" role="tabpanel" hidden></div>`;
  const shortcut = document.createElement("button");
  shortcut.className = "chat-shortcut";
  shortcut.hidden = true;
  shortcut.type = "button";
  target.append(root, shortcut);
  const list = root.querySelector("ol"),
    journal = root.querySelector(".journal-panel"),
    panel = root.querySelector(".chat-panel");
  let mode = "journal",
    analysis = false,
    state,
    lang = language,
    t = translator(lang),
    following = true,
    key = "",
    visible = false;
  const view = chat
    ? mountChat(panel, {
        chat,
        openPlayer,
        styles: true,
        labels:
          language === "fr"
            ? {
                send: "Envoyer",
                sending: "Envoi…",
                empty: "Aucun message",
                message: "Message",
                edited: "modifié",
              }
            : undefined,
      })
    : null;
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      syncVisibility();
    },
    { threshold: 0.15 },
  );
  observer.observe(panel);
  function syncVisibility() {
    chat?.setOpen(mode === "chat" && !analysis && visible);
  }
  function select(kind) {
    mode = kind === "chat" && chat && !analysis ? "chat" : "journal";
    journal.hidden = mode !== "journal";
    panel.hidden = mode !== "chat";
    for (const b of root.querySelectorAll("[data-tab]")) {
      b.setAttribute("aria-selected", String(b.dataset.tab === mode));
      b.tabIndex = b.dataset.tab === mode ? 0 : -1;
    }
    if (mode === "chat") view?.open();
    else if (view) view.element.open = false;
    syncVisibility();
  }
  function open(kind) {
    select(kind);
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    if (kind === "journal") list.focus({ preventScroll: true });
  }
  function eventHtml(e) {
    const name = state?.players[e.p]?.name ?? "";
    const actor = name
      ? `<strong style="color:${state.players[e.p].color}">${esc(name)}</strong>`
      : "";
    switch (e.type) {
      case "action":
        return `${actor} ${icon(e.action)}${e.good ? icon(e.good) : ""}${e.fish ? e.fish.map((n) => token("fish", n)).join("") : ""}${e.path ? ` ${e.path.length} ${icon("sail")}` : ""}${e.bonus ? ` <small>${esc(CHARACTERS[state.players[e.p]?.character]?.[lang === "fr" ? "fr" : "name"] ?? "")}</small>` : ""}`;
      case "plan":
      case "neutral":
        return `${actor} ${e.actions.map((a) => icon(a)).join("")}${e.type === "neutral" ? ` <span class="neutral-key">●</span>` : ""}`;
      case "character":
        return `${actor} <span>${esc(CHARACTERS[e.character]?.[lang === "fr" ? "fr" : "name"] ?? e.character)}</span>`;
      case "conversion":
        return `${actor} ${token("coin", e.points * 2)} → ${token("point", e.points)}`;
      case "treasure":
        return `${actor} ${token(
          "explore",
          e.values.reduce((a, b) => a + b, 0),
        )} → ${token(
          "coin",
          e.values.reduce((a, b) => a + b, 0),
        )}`;
      case "beg":
        return `${actor} ${token("point", e.amount)} → ${token("coin", e.amount)}`;
      case "discard":
        return `${actor} ${icon("undo")} ${icon(e.action)}`;
      case "governor":
        return `${actor} ${icon(e.from)} → ${icon(e.to)}`;
      case "rest":
        return `${actor} ${icon("rest")}`;
      case "restBonus":
        return `${actor} ${e.token === "first" ? icon("first") : e.token === "both" ? token("coin", 1) + token("point", 1) : token(e.token, 1)}`;
      case "round":
        return `<b>${t("round")} ${e.round}/8</b>`;
      case "place":
        return `${actor} ${t("expand")}`;
      case "flood":
        return `${icon("water")} ${t("water")}`;
      case "end":
        return `<b>${t("finished")}</b>`;
      default:
        return "";
    }
  }
  function refresh() {
    if (!state) return;
    const next = JSON.stringify(state.events ?? state.lastEvents ?? []) + lang;
    if (next === key) return;
    key = next;
    list.innerHTML = (state.events ?? state.lastEvents ?? [])
      .map((e) => ({ e, html: eventHtml(e) }))
      .filter((x) => x.html)
      .map(({ e, html }) => `<li><small>${e.round}</small>${html}</li>`)
      .join("");
    if (following)
      requestAnimationFrame(() => (list.scrollTop = list.scrollHeight));
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) open(b.dataset.tab);
    if ("back" in b.dataset) onBack?.();
  });
  shortcut.onclick = () => open("chat");
  list.addEventListener("scroll", () => {
    following = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  });
  select("journal");
  return {
    open,
    update(s, isAnalysis) {
      state = s;
      analysis = isAnalysis;
      root.querySelector('[data-tab="chat"]').hidden = !chat || analysis;
      if (analysis && mode === "chat") select("journal");
      refresh();
    },
    setUnread(n) {
      const badge = root.querySelector(".unread");
      badge.textContent = n;
      badge.hidden = !n;
      shortcut.hidden = !n || analysis;
      shortcut.innerHTML = `${icon("chat")} ${n}`;
      shortcut.setAttribute("aria-label", `${t("chat")}: ${n}`);
    },
    setLanguage(l) {
      lang = l;
      t = translator(l);
      root.querySelector("[data-back] span").textContent = t("board");
      root.querySelector('[data-tab="chat"] span').textContent = t("chat");
      refresh();
    },
    destroy() {
      observer.disconnect();
      view?.destroy();
      root.remove();
      shortcut.remove();
    },
  };
}

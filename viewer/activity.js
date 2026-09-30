import { assets } from "./assets.js";
import { createRenderer } from "./dom.js";
import { tilePreviewSvg } from "./board.js";
import { blockingHtml } from "./blocking.js";
import { translateText } from "./localization/index.js";
import { mountChat } from "@boardgamers/protocol/chat/dom";
import {
  icon as renderIcon,
  token as renderToken,
  iconLabel,
  esc,
} from "./art.js";
import { translator } from "./labels.js";
import { journalRows } from "./journal.js";
import { ACTIONS, CHARACTERS, COLORS } from "../engine/catalog.js";
export function mountActivity(
  target,
  { chat, openPlayer, avatarForPlayer, onBack, language = "en" } = {},
) {
  let colorBlind = false,
    lang = language;
  const icon = (name) =>
    renderIcon(name, translateText(iconLabel(name), lang), false, colorBlind);
  const token = (name, n) =>
    renderToken(
      name,
      n,
      `${translateText(iconLabel(name), lang)}: ${n}`,
      colorBlind,
    );
  const markerToken = (action, n) =>
    renderToken(
      action,
      n,
      `${translateText("Markers", lang)}: ${n} · ${translateText(translator(lang)(action), lang)}`,
      colorBlind,
    );
  const root = document.createElement("section");
  root.className = "activity";
  root.innerHTML = `<header><div class="activity-tabs" role="tablist"><button type="button" role="tab" data-tab="journal">${icon("journal")} <span>Journal</span></button><button type="button" role="tab" data-tab="chat" ${chat ? "" : "hidden"}>${icon("chat")} <span>Chat</span> <b class="unread" hidden></b></button></div><button type="button" class="text-button" data-back>↑ <span>Board</span></button></header><div class="journal-panel" role="tabpanel"><ol class="event-list" tabindex="0"></ol></div><div class="chat-panel" role="tabpanel" hidden></div>`;
  const shortcut = document.createElement("button");
  shortcut.className = "chat-shortcut";
  shortcut.hidden = true;
  shortcut.type = "button";
  target.append(root, shortcut);
  const list = root.querySelector("ol"),
    journal = root.querySelector(".journal-panel"),
    panel = root.querySelector(".chat-panel");
  const wide = window.matchMedia("(min-width: 1100px)");
  const patch = createRenderer("li");
  let mode = "journal",
    analysis = false,
    state,
    t = translator(lang),
    following = true,
    followFrame,
    unreadKey,
    labelsLanguage,
    rowSources = [],
    key = "";
  const view = chat
    ? mountChat(panel, {
        chat,
        openPlayer,
        styles: true,
        labels: undefined,
        renderAuthor(message) {
          const index = message.playerIndex;
          if (index === undefined) return undefined;
          const author = document.createElement(
            openPlayer ? "button" : "strong",
          );
          author.className = "chat-author";
          author.dataset.bgsPlayer = index;
          const color = state?.players[index]?.color ?? COLORS[index];
          if (color) author.style.setProperty("--chat-player-color", color);
          const avatar = avatarForPlayer?.(index);
          if (avatar) {
            const img = document.createElement("img");
            img.className = "player-avatar";
            img.src = avatar;
            img.alt = "";
            author.append(img);
          }
          author.append(
            document.createTextNode(
              message.author ?? state?.players[index]?.name ?? "",
            ),
          );
          if (openPlayer) {
            author.type = "button";
            author.onclick = () => openPlayer(index);
          }
          return author;
        },
      })
    : null;
  if (view) {
    // Keep the composer outside the scrolling feed, within the fixed tab height.
    const body = document.createElement("div");
    body.className = "chat-body";
    for (const child of [...view.element.children]) {
      if (!child.matches("summary, style")) body.append(child);
    }
    view.element.append(body);
  }
  function select(kind) {
    mode = kind === "chat" && chat && !analysis ? "chat" : "journal";
    const split = wide.matches && !!chat && !analysis;
    root.classList.toggle("split", split);
    root
      .querySelector(".activity-tabs")
      .setAttribute("role", split ? "group" : "tablist");
    journal.hidden = !split && mode !== "journal";
    panel.hidden = !split && mode !== "chat";
    for (const p of [journal, panel])
      p.setAttribute("role", split ? "region" : "tabpanel");
    for (const b of root.querySelectorAll("[data-tab]")) {
      b.setAttribute("role", split ? "button" : "tab");
      if (split) b.removeAttribute("aria-selected");
      else b.setAttribute("aria-selected", String(b.dataset.tab === mode));
      b.tabIndex = split || b.dataset.tab === mode ? 0 : -1;
    }
    // The shared feed tracks which messages are actually visible. Closing its
    // details when offscreen would collapse the panel and move the page.
    chat?.setOpen(split || (mode === "chat" && !analysis));
    view?.refresh();
  }
  const resize = () => select(mode);
  wide.addEventListener("change", resize);
  function open(kind) {
    select(kind);
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    if (kind === "journal") list.focus({ preventScroll: true });
  }
  const text = (source) => esc(translateText(source, lang));
  const playerName = (p) =>
    state?.players[p]
      ? `<strong class="event-player" translate="no" style="color:${esc(state.players[p].color)}">${esc(state.players[p].name)}</strong>`
      : "";
  const chip = (html, kind = "") =>
    `<span class="event-chip ${kind}">${html}</span>`;
  const gain = (name, n) => chip(token(name, `+${n}`), "event-gain");
  const cost = (n) =>
    chip(n ? token("coin", `−${n}`) : text("Free"), "event-cost");
  const location = (cell) =>
    cell
      ? `<span class="event-coordinate" title="${text("Location")}" translate="no">${esc(cell)}</span>`
      : "";
  function portrait(character) {
    const c = CHARACTERS[character];
    return c
      ? `<span class="event-role" title="${text(c.name)}"><img class="event-character" src="${assets["character-" + c.art]}" alt="${text(c.name)}"></span>`
      : "";
  }
  function heading(e, label, symbol, character) {
    return `<span class="event-main">${playerName(e.p)}${portrait(character)} <span class="event-verb">${symbol ? icon(symbol) : ""}${label}</span></span>`;
  }
  const details = (html) =>
    html ? `<span class="event-details">${html}</span>` : "";
  function eventHtml(e) {
    const d = e.details ?? {};
    switch (e.type) {
      case "action": {
        const parts = [];
        if (d.cost !== undefined) parts.push(cost(d.cost));
        if (e.path) parts.push(chip(token("sail", e.path.length)));
        if (e.action === "sell") {
          const fish = token(
            "fish",
            e.fish.reduce((a, b) => a + b, 0),
          );
          parts.push(
            chip(
              d.price === undefined
                ? fish
                : `${fish} × ${token("coin", d.price)} → ${token("coin", `+${d.income}`)}`,
              "event-gain",
            ),
          );
        }
        if (d.fish !== undefined) parts.push(gain("fish", d.fish));
        if (d.treasure !== undefined) parts.push(gain("explore", d.treasure));
        if (e.good) parts.push(chip(token(e.good, d.shipments?.length ?? 1)));
        if (e.hut) parts.push(chip(token("build", 1)));
        if (e.dike) parts.push(chip(token("dike", 1)));
        if (e.action === "tourist") parts.push(chip(token("tourist", 1)));
        if (
          d.income !== undefined &&
          !(e.action === "sell" && d.price !== undefined)
        )
          parts.push(gain("coin", d.income));
        if (d.points !== undefined) parts.push(gain("point", d.points));
        const route = e.path
          ? `${location(d.from)} → ${location(e.path.at(-1))}`
          : location(d.cell ?? e.cell);
        const completions =
          d.shipments
            ?.filter((s) => s.complete)
            .map((s) =>
              chip(`${icon("check")}${text("Ship completed (+2 included)")}`),
            )
            .join("") ?? "";
        const role =
          d.character ??
          (e.preach
            ? "preacher"
            : e.bonus
              ? Object.keys(CHARACTERS).find(
                  (c) => CHARACTERS[c].action === e.action,
                )
              : null);
        const rest =
          e.action === "rest" && e.restToken && e.restToken !== "hidden"
            ? restReward(e.restToken, false)
            : "";
        return (
          heading(
            e,
            text(
              e.action === "rest" && e.restToken
                ? "Rest token chosen"
                : t(e.action),
            ),
            e.action,
            role,
          ) +
          details(parts.join("") + rest) +
          (route || completions
            ? `<span class="event-context">${route}${completions}</span>`
            : "")
        );
      }
      case "plan":
      case "neutral": {
        const counts = Object.fromEntries(
          ACTIONS.map((a) => [a, e.actions.filter((v) => v === a).length]),
        );
        const added = ACTIONS.filter((a) => counts[a])
          .map((a) => chip(markerToken(a, `+${counts[a]}`)))
          .join("");
        const totals = e.totals
          ? `<span class="event-totals"><span>${text("Planned")}</span>${ACTIONS.filter(
              (a) => e.totals[a],
            )
              .map((a) => markerToken(a, e.totals[a]))
              .join("")}</span>`
          : "";
        return (
          heading(
            e,
            text(e.type === "neutral" ? t("neutral") : "Place markers"),
            "marker",
          ) +
          details(added) +
          totals
        );
      }
      case "character":
        return heading(
          e,
          `${portrait(e.character)}${text(CHARACTERS[e.character]?.name ?? e.character)}`,
        );
      case "conversion":
        return (
          heading(e, "") +
          details(
            chip(
              `${token("coin", `−${e.points * 2}`)} → ${token("point", `+${e.points}`)}`,
            ),
          )
        );
      case "treasure": {
        const n = e.values.reduce((a, b) => a + b, 0);
        return (
          heading(e, text(t("treasure")), "explore") +
          details(chip(`${token("explore", n)} → ${token("coin", `+${n}`)}`))
        );
      }
      case "beg":
        return (
          heading(e, text(t("beg"))) +
          details(
            chip(
              `${token("point", `−${e.amount}`)} → ${token("coin", `+${e.amount}`)}`,
            ) + portrait("beggar"),
          )
        );
      case "discard":
        return (
          heading(e, text("Retrieve without acting"), "warning") +
          details(chip(markerToken(e.action, e.markers ?? ""), "event-cost")) +
          (e.blockers
            ? `<span class="event-explanation">${blockingHtml(state, e.p, e.action, lang, e.blockers)}</span>`
            : "")
        );
      case "governor":
        return (
          heading(e, text(t("governor"))) +
          details(
            chip(
              `${markerToken(e.from, e.markers ?? "")} → ${markerToken(e.to, e.markers ?? "")}`,
            ) + portrait("governor"),
          )
        );
      case "rest":
        return (
          heading(e, text("Rest token chosen"), "rest") +
          details(e.token !== "hidden" ? restReward(e.token, false) : "")
        );
      case "restBonus":
        return (
          heading(e, text(t("rest")), "rest") + details(restReward(e.token))
        );
      case "place":
        return (
          heading(e, "") +
          `<span class="event-tile" role="img" aria-label="${esc(t("expand") + " " + e.cell)}">${tilePreviewSvg(e.tile, { colorBlind, t, language: lang, prefix: "event-" + e.cell })}</span>${location(e.cell)}`
        );
      case "flood":
        return heading(e, text(t("water")), "water");
      case "submerged":
        return heading(e, text("Submerged"), "water") + location(e.cell);
      case "lost":
        return `<b>${text(t("lost"))}</b>`;
      case "end":
        return `<b>${text(t("finished"))}</b>${details((e.scores ?? []).map((score, p) => chip(`${playerName(p)} ${token("point", score)}`)).join(""))}`;
      default:
        return "";
    }
  }
  function restReward(value, awarded = true) {
    const reward = (name) => (awarded ? gain(name, 1) : chip(token(name, 1)));
    if (value === "first") return chip(`${icon("first")}${text(t("first"))}`);
    if (value === "both") return reward("coin") + reward("point");
    return ["coin", "point"].includes(value) ? reward(value) : "";
  }
  function rowHtml(row) {
    if (row.kind === "round")
      return `<li class="round-divider"><b>${text(t("round"))} ${row.round}/8</b>${row.first !== undefined ? `<span class="event-first">${icon("first")}${playerName(row.first)}</span>` : ""}</li>`;
    if (row.kind === "phase") {
      const label =
        {
          plan: "Marker placement",
          actions: "Actions",
          restBonus: "Rest bonuses",
        }[row.phase] ?? t(row.phase);
      const symbol = {
        plan: "marker",
        actions: "check",
        restBonus: "rest",
        character: "eye",
        expand: "overview",
        neutral: "marker",
        ended: "point",
      }[row.phase];
      return `<li class="phase-divider">${symbol ? icon(symbol) : ""}<b>${text(label)}</b>${row.pass ? `<span>${row.pass}/3</span>` : ""}</li>`;
    }
    const html = eventHtml(row.event);
    return html
      ? `<li class="journal-event event-${esc(row.event.type === "character" ? "select-character" : row.event.type)}">${html}</li>`
      : "";
  }
  function refresh() {
    if (!state) return;
    const next =
      JSON.stringify(state.events ?? state.lastEvents ?? []) +
      lang +
      colorBlind +
      JSON.stringify(state.players.map(({ name, color }) => [name, color])) +
      state.boardLayout;
    if (next === key) return;
    key = next;
    const rows = journalRows(state).map(rowHtml).filter(Boolean);
    const mounted = [...list.children];
    for (let i = 0; i < Math.min(mounted.length, rows.length); i++)
      if (rowSources[i] !== rows[i]) patch(mounted[i], rows[i]);
    for (const row of mounted.slice(rows.length)) row.remove();
    if (rows.length > mounted.length)
      list.insertAdjacentHTML("beforeend", rows.slice(mounted.length).join(""));
    rowSources = rows;
    cancelAnimationFrame(followFrame);
    if (following)
      followFrame = requestAnimationFrame(() => {
        if (following) list.scrollTop = list.scrollHeight;
      });
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tab) select(b.dataset.tab);
    if ("back" in b.dataset) onBack?.();
  });
  shortcut.onclick = () => open("chat");
  list.addEventListener("scroll", () => {
    following = list.scrollHeight - list.scrollTop - list.clientHeight <= 1;
  });
  select("journal");
  return {
    open,
    update(s, isAnalysis, isColorBlind = false) {
      colorBlind = isColorBlind;
      state = s;
      const changed = analysis !== isAnalysis;
      analysis = isAnalysis;
      root.querySelector('[data-tab="chat"]').hidden = !chat || analysis;
      if (changed) select(mode);
      refresh();
    },
    refreshAvatars() {
      view?.refresh();
    },
    setUnread(n, notifications = true) {
      const next = `${n}:${notifications}:${analysis}:${lang}:${colorBlind}`;
      if (unreadKey === next) return;
      unreadKey = next;
      const badge = root.querySelector(".unread");
      badge.textContent = n;
      badge.hidden = !n;
      shortcut.hidden = !notifications || !n || analysis;
      shortcut.innerHTML = `${icon("chat")} ${n}`;
      shortcut.setAttribute("aria-label", `${t("chat")}: ${n}`);
    },
    setLanguage(l) {
      if (labelsLanguage === l) return;
      labelsLanguage = l;
      lang = l;
      t = translator(l);
      root.querySelector("[data-back] span").textContent = t("board");
      root.querySelector('[data-tab="chat"] span').textContent = t("chat");
      journal.setAttribute("aria-label", t("journal"));
      panel.setAttribute("aria-label", t("chat"));
      refresh();
    },
    destroy() {
      cancelAnimationFrame(followFrame);
      wide.removeEventListener("change", resize);
      view?.destroy();
      root.remove();
      shortcut.remove();
    },
  };
}

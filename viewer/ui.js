import {
  ACTIONS,
  CHARACTERS,
  TILES,
  PRICES,
  VALUES,
} from "../engine/catalog.js";
import { assets } from "./assets.js";
import {
  icon as renderIcon,
  token as renderToken,
  iconLabel,
  esc,
} from "./art.js";
import { boardSvg, center, tilePreviewSvg } from "./board.js";
import { translator, characterHelp } from "./labels.js";
import { mountActivity } from "./activity.js";
import { rulesHtml } from "./rules.js";
import { createMoveSound } from "./sound.js";
import { languages, resolveLocale } from "./localization/index.js";
const total = (a) => a.reduce((a, b) => a + b, 0);
const unique = (a) => [...new Set(a)];
function coastArrow(cell, edge) {
  const a = center(cell),
    b = center(edge),
    angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return `<svg class="icon" viewBox="0 0 32 32" role="img" aria-label="Coast"><path d="M6 16h20m-8-8 8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.5" transform="rotate(${angle} 16 16)"/></svg>`;
}
const symbols = ["●", "◆", "▲", "■", "✦"];
export function mountGame(target, options = {}) {
  const root = document.createElement("div");
  root.className = "vanuatu";
  root.innerHTML =
    '<div class="play"></div><div class="activity-root"></div><dialog class="help-dialog"></dialog><div class="feedback" role="alert" hidden></div>';
  target.append(root);
  const play = root.querySelector(".play"),
    dialog = root.querySelector("dialog"),
    feedback = root.querySelector(".feedback");
  let s,
    player,
    enabled = true,
    analysis = false,
    pending = false,
    selected = null,
    action = null,
    draft = [],
    tile = null,
    bonus = true,
    zoom = false,
    overview = false,
    lang = resolveLocale(options.language ?? "en"),
    hostedLocale = false,
    colorBlind = false,
    sound = false,
    revision,
    focusReturn;
  const icon = (name, label) =>
    renderIcon(
      name,
      label ?? iconLabel(name, lang),
      label !== undefined,
      colorBlind,
    );
  const token = (name, n, label) =>
    renderToken(name, n, label ?? `${iconLabel(name, lang)}: ${n}`, colorBlind);
  let t = translator(lang);
  const moveSound = createMoveSound();
  const events = new AbortController();
  const listener = { signal: events.signal };
  const trayObserver = new ResizeObserver(([entry]) => {
    entry.target.parentElement?.style.setProperty(
      "--tray-height",
      `${entry.target.getBoundingClientRect().height}px`,
    );
  });
  function observeTray() {
    trayObserver.disconnect();
    const tray = play.querySelector(".turn-tray");
    if (tray) trayObserver.observe(tray);
  }
  const activity = mountActivity(root.querySelector(".activity-root"), {
    chat: options.chat,
    openPlayer: options.onOpenPlayer,
    onBack: () => play.scrollIntoView({ block: "start" }),
    language: lang,
  });
  activity.setLanguage(lang);
  const legal = () => (enabled && !pending ? (s?.legal ?? []) : []);
  const working = () =>
    legal().filter((m) => !["treasure", "beg"].includes(m.type));
  const actMoves = () =>
    working().filter(
      (m) =>
        m.type === "act" &&
        m.action === action &&
        (action !== "sail" || m.path.at(-1) !== own()?.boat),
    );
  const actualTargets = () =>
    action === "sail"
      ? unique(actMoves().map((m) => m.path.at(-1)))
      : unique(
          actMoves()
            .map((m) => m.cell)
            .filter(Boolean),
        );
  const own = () => s?.players[player];
  const charName = (c) => esc(CHARACTERS[c]?.["name"] ?? c);
  const charHelp = (c) => esc(characterHelp[c]?.[0] ?? "");
  function btn(content, attr = "", className = "") {
    return `<button type="button" class="${className}" ${attr}>${content}</button>`;
  }
  const titled = (name, content, attr = "", cls = "") =>
    btn(content, `title="${esc(name)}" aria-label="${esc(name)}" ${attr}`, cls);
  function actionDetail(m) {
    if (m.type === "place") return `${t("choose")} ${icon("check")}`;
    if (m.type === "character") return charName(m.character);
    if (m.type === "plan" || m.type === "neutral")
      return m.actions.map((a) => icon(a)).join("");
    if (m.type === "discard")
      return `${icon("undo")} ${"Retrieve without acting"} ${icon(m.action)}`;
    if (m.type === "rest") return restContent(m.token);
    if (m.type === "governor") return `${icon(m.from)} → ${icon(m.to)}`;
    if (m.type === "treasure")
      return `${token("explore", total(m.values))} → ${token("coin", total(m.values))}`;
    if (m.type === "beg")
      return `${token("point", m.amount)} → ${token("coin", m.amount)}`;
    if (m.action === "sail")
      return `${token("sail", m.path.length)} · ${token("coin", m.bonus ? 0 : m.path.length)}`;
    if (m.action === "fish")
      return `${token("fish", s.board[own().boat].fish)}${m.bonus ? " + " + token("point", s.board[own().boat].fish) : ""}`;
    if (m.action === "explore")
      return `${token("explore", s.board[own().boat].treasure)}${m.bonus ? " + " + token("coin", s.board[own().boat].treasure) : ""}`;
    if (m.action === "sell")
      return `${m.fish.map((n) => token("fish", n)).join("")} → ${token("coin", total(m.fish) * s.market)}`;
    if (m.action === "build")
      return `${m.hut ? token("build", 1) : ""}${m.dike ? token("dike", 1) : ""} · ${token("coin", (m.hut ? (m.bonus ? 1 : 3) : 0) + (m.dike ? 1 : 0))}${m.dike ? ` <small>${coastArrow(m.cell, m.dike)}</small>` : ""}`;
    if (m.action === "buy") {
      let gain = 0;
      const ships = s.demands.map((d) => ({ ...d, filled: [...d.filled] }));
      for (let n = 0; n < (m.bonus ? 2 : 1); n++) {
        const d = ships.find((d) =>
          d.goods.some((g, i) => g === m.good && !d.filled[i]),
        );
        if (!d) continue;
        d.filled[d.goods.findIndex((g, i) => g === m.good && !d.filled[i])] =
          true;
        gain += VALUES[m.good] + (d.filled.every(Boolean) ? 2 : 0);
      }
      return `${token(m.good, m.bonus ? 2 : 1)} · ${token("coin", PRICES[m.good])} → ${token("point", gain)}`;
    }
    if (m.action === "draw")
      return `${icon("draw")} → ${token("point", m.bonus ? 5 : 3)}`;
    if (m.action === "tourist")
      return `${icon("tourist")} → ${token("coin", s.board[m.cell].huts.length)}${m.bonus ? " + " + token("point", s.board[m.cell].drawings * 2) : ""}`;
    return `${icon(m.action)} ${t(m.action)}`;
  }
  function moveButton(m, primary = false) {
    const idx = (s.legal ?? []).indexOf(m);
    return btn(
      actionDetail(m),
      `data-move="${idx}" ${pending ? "disabled" : ""}`,
      primary ? "primary move-option" : "move-option",
    );
  }
  function restContent(key) {
    return key === "first"
      ? icon("first")
      : key === "both"
        ? `${token("coin", 1)} + ${token("point", 1)}`
        : token(key, 1);
  }
  function playerCard(p, i) {
    const c = CHARACTERS[p.character];
    return `<section class="player-card ${i === s.actor && !s.finished ? "active" : ""} ${i === player ? "own" : ""}" style="--player:${p.color}"><div class="player-name">${btn(`${colorBlind ? symbols[i] + " " : ""}${esc(p.name)}`, `data-bgs-player="${i}"`, "profile")} ${s.first === i ? icon("first", t("first")) : ""}<strong class="score">${token("point", p.score)}</strong></div><div class="player-supplies">${token("coin", p.money)}<span class="hand" title="${t("fishStock")}">${p.fish.length ? p.fish.map((n) => token("fish", n)).join("") : token("fish", 0)}</span><span class="hand" title="${t("treasure")}">${p.treasures.length ? p.treasures.map((n) => token("explore", n)).join("") : token("explore", 0)}</span>${token("build", p.hutsLeft)}</div>${c ? `<button type="button" class="character-owned ${p.used ? "used" : ""}" data-character="${p.character}"><img src="${assets["character-" + c.art]}" alt=""><span>${charName(p.character)}</span>${p.used ? icon("check") : icon(c.action ?? "point")}</button>` : ""}${i === player ? `<div class="free-actions">${legal().some((m) => m.type === "treasure") ? btn(`${icon("explore")} → ${icon("coin")}`, `data-free="treasure" title="${t("treasure")}"`) : ""}${legal().some((m) => m.type === "beg") ? btn(`${icon("point")} → ${icon("coin")}`, `data-free="beg" title="${t("beg")}"`) : ""}</div>` : ""}</section>`;
  }
  function dock() {
    const planning = ["plan", "neutral"].includes(s.phase) && working().length;
    return `<nav class="action-dock" aria-label="${t("actions")}">${ACTIONS.map(
      (a) => {
        const countDraft = draft.filter((x) => x === a).length;
        const allowed = planning
          ? working().some((m) =>
              s.phase === "neutral"
                ? draft.length < m.actions.length &&
                  [...draft, a].every(
                    (x) =>
                      [...draft, a].filter((y) => y === x).length <=
                      m.actions.filter((y) => y === x).length,
                  )
                : m.actions
                    ?.slice(0, draft.length)
                    .every((x, i) => x === draft[i]) &&
                  m.actions[draft.length] === a,
            )
          : working().some(
              (m) =>
                (m.type === "act" || m.type === "discard") && m.action === a,
            );
        const retrieveOnly =
          !planning &&
          allowed &&
          working().some((m) => m.type === "discard" && m.action === a) &&
          !working().some((m) => m.type === "act" && m.action === a);
        const explain =
          planning &&
          s.phase === "plan" &&
          !allowed &&
          draft.length < (s.planningPass === 2 ? 1 : 2);
        const hint = explain
          ? ({
              fish: "Fishing requires fish on your boat's space. Plan Sail first if needed.",
              explore:
                "Exploring requires treasure on your boat's space. Plan Sail first if needed.",
              sell: own()?.fish.length
                ? undefined
                : "Selling requires fish. Plan Fish first if your hold is empty.",
            }[a] ??
            "This action is not possible with your current resources and planned actions. Plan its prerequisites first.")
          : "";
        const stacks = s.players
          .map((p, i) =>
            p.markers[a]
              ? `<span class="marker-stack ${s.majorities?.[i]?.includes(a) ? "majority" : ""}" style="--player:${p.color}" title="${esc(p.name)}: ${p.markers[a]}">${colorBlind ? symbols[i] : ""}${p.markers[a]}</span>`
              : "",
          )
          .join("");
        return btn(
          `<span class="action-symbol">${icon(a)}</span><span class="action-content"><span class="action-label">${t(a)}</span><span class="action-stacks">${stacks}${retrieveOnly ? `<span class="retrieve-only-icon">${icon("undo", "Retrieve without acting")}</span>` : ""}${s.neutral[a] ? `<span class="marker-stack neutral" title="${"Neutral markers"}">${s.neutral[a]}</span>` : ""}${countDraft ? `<span class="draft-marker" title="${"Markers being placed"}">+${countDraft}</span>` : ""}</span></span>`,
          `data-action="${a}" ${retrieveOnly ? `title="${"Retrieve without acting"}"` : ""} ${allowed ? "" : explain ? `aria-disabled="true" data-unavailable="${esc(hint)}" title="${esc(hint)}"` : "disabled"} aria-pressed="${action === a}"`,
          `${action === a ? "chosen" : ""} ${allowed ? "available" : ""} ${retrieveOnly ? "retrieve-only" : ""}`,
        );
      },
    ).join("")}</nav>`;
  }
  function tray() {
    const moves = working();
    if (s.finished)
      return `<div class="turn-tray end-tray"><strong>${s.lost ? t("lost") : t("finished")}</strong>${btn(`${icon("point")} ${t("ended")}`, "data-scores", "primary")}</div>`;
    if (!moves.length)
      return `<div class="turn-tray waiting"><span class="turn-dot" style="background:${s.players[s.actor]?.color}"></span>${pending ? t("pending") : `${t("waiting")} <strong>${esc(s.players[s.actor]?.name ?? "")}</strong>`}</div>`;
    if (s.phase === "character")
      return `<div class="turn-tray character-tray"><div class="tray-title">${t("character")}</div><div class="character-choices">${moves
        .filter((m) => m.type === "character")
        .map((m) => {
          const c = CHARACTERS[m.character];
          return btn(
            `<img src="${assets["character-" + c.art]}" alt=""><strong>${charName(m.character)}</strong><span>${charHelp(m.character)}</span>`,
            `data-character-choice="${m.character}"`,
            "character-choice",
          );
        })
        .join("")}</div></div>`;
    if (["plan", "neutral"].includes(s.phase)) {
      const prefix = (m) =>
        m.actions?.slice(0, draft.length).every((x, i) => x === draft[i]);
      const complete = moves.find(
        (m) => prefix(m) && m.actions.length === draft.length,
      );
      const count = moves[0]?.actions?.length ?? 0;
      return `<div class="turn-tray"><div class="tray-title">${t(s.phase)} <small>${draft.length}/${count}</small></div><div class="draft-slots">${Array.from({ length: count }, (_, i) => `<span class="draft-slot">${draft[i] ? icon(draft[i]) : icon("marker")}</span>`).join("")}</div>${titled(t("undo"), icon("undo"), `data-undo ${draft.length ? "" : "disabled"}`, "icon-button")}${complete ? btn(`${icon("check")} ${t("confirm")}`, `data-move="${s.legal.indexOf(complete)}"`, "primary") : ""}</div>`;
    }
    if (s.phase === "expand") {
      const tileChoices = unique(
        moves.filter((m) => m.type === "place").map((m) => m.tile),
      );
      if (!tileChoices.includes(tile)) tile = tileChoices[0];
      const m = moves.find(
        (m) => m.type === "place" && m.tile === tile && m.cell === selected,
      );
      return `<div class="turn-tray"><div class="tray-title">${t("expand")}</div><div class="tile-choices">${tileChoices.map((id) => btn(`<img src="${assets[TILES[id].art]}" alt="${TILES[id].type === "island" ? t("island") : t("sea")}">`, `data-tile="${id}" aria-pressed="${tile === id}"`)).join("")}</div>${m ? moveButton(m, true) : ""}</div>`;
    }
    if (s.phase === "rest")
      return `<div class="turn-tray"><strong>${t("restChoice")}</strong>${moves
        .filter((m) => m.type === "rest")
        .map((m) => moveButton(m, true))
        .join("")}</div>`;
    let opts = actMoves().sort(
      (a, b) => (a.path?.length ?? 0) - (b.path?.length ?? 0),
    );
    const selectedAction = !!action;
    const hasBonus = opts.some((m) => m.bonus),
      hasNormal = opts.some((m) => !m.bonus);
    opts = opts.filter((m) => !hasBonus || !hasNormal || m.bonus === bonus);
    const targets = actualTargets();
    if (targets.length)
      opts = opts.filter((m) => (m.cell ?? m.path?.at(-1)) === selected);
    // Only the destination and cost matter: longer routes have no added effect.
    if (action === "sail") opts = opts.slice(0, 1);
    const discard = moves.find(
      (m) => m.type === "discard" && m.action === action,
    );
    const governor = moves.some((m) => m.type === "governor");
    const buildCost = own()?.character === "builder" && !own()?.used ? 1 : 3;
    const pickText =
      discard &&
      action === "build" &&
      !s.options.risingWaters &&
      own()?.money < buildCost
        ? `${"Not enough vatus."} ${token("coin", `${own().money}/${buildCost}`, `${t("cost")}: ${buildCost}`)}`
        : targets.length && !selected
          ? `${icon("sail")} ${"Choose a space"}`
          : "";
    return `<div class="turn-tray"><div class="tray-title">${selectedAction ? `${icon(action)} ${t(action)}` : t("actions")}</div>${hasBonus && hasNormal ? `<label class="bonus-switch" title="${charHelp(own()?.character)}"><input type="checkbox" data-bonus ${bonus ? "checked" : ""}>${charName(own()?.character)}</label>` : ""}<span class="pick-hint">${pickText}</span><div class="move-options">${opts.map((m) => moveButton(m, true)).join("")}${discard ? moveButton(discard) : ""}</div>${governor ? btn(`${icon("marker")} ↔`, `data-governor title="${t("governor")}"`) : ""}${selectedAction ? titled(t("cancel"), icon("close"), "data-cancel", "icon-button") : ""}</div>`;
  }
  function tradeShips() {
    const help = `Foreign trade\n${colorBlind ? "K: kava · C: copra · B: beef." : "Green: kava · White: copra · Red: beef."}\nEach export fills the first ship (1 → 3) still needing that good. ✓ = already delivered.\nCompleting a ship adds 2 prosperity points.`;
    return `<div class="demand-ships" title="${esc(help)}" aria-label="${esc(help)}">${s.demands.map((d, i) => `<div class="demand-ship"><small>${i + 1}</small>${d.goods.map((g, j) => `<span class="${d.filled[j] ? "filled" : ""}">${icon(g)}${d.filled[j] ? icon("check") : ""}</span>`).join("")}${icon("buy")}</div>`).join("")}</div>`;
  }
  function renderControls() {
    const focus = document.activeElement?.getAttribute("data-action");
    play.querySelector(".action-dock").outerHTML = dock();
    play.querySelector(".turn-tray").outerHTML = tray();
    observeTray();
    const targets = new Set(actualTargets());
    for (const cell of play.querySelectorAll(".map-cell[data-cell]")) {
      const id = cell.dataset.cell;
      const selectable = targets.has(id);
      cell.classList.toggle("legal", selectable);
      cell.classList.toggle("selected", selected === id);
      const highlight = play.querySelector(`[data-highlight-cell="${id}"]`);
      highlight?.classList.toggle("legal", selectable);
      highlight?.classList.toggle("selected", selected === id);
      if (selectable) {
        cell.setAttribute("role", "button");
        cell.setAttribute("tabindex", "0");
        cell.setAttribute(
          "aria-label",
          `${t(s.board[id]?.type === "island" ? "island" : "sea")} ${id}`,
        );
      } else {
        for (const attribute of ["role", "tabindex", "aria-label"])
          cell.removeAttribute(attribute);
      }
    }
    if (focus)
      play
        .querySelector(`[data-action="${focus}"]`)
        ?.focus({ preventScroll: true });
  }
  function render() {
    if (!s) {
      play.innerHTML = `<p class="loading">${t("connected")}</p>`;
      return;
    }
    const focus = play.contains(document.activeElement)
      ? document.activeElement?.getAttribute("data-action")
      : null;
    const scroll = play.querySelector(".map-scroll");
    const sx = scroll?.scrollLeft ?? 0,
      sy = scroll?.scrollTop ?? 0;
    const trayHtml = tray();
    const marketHelp = `Fish price: ${s.market} vatus per fish value. Falls by 1 after each sale (minimum 1); resets to 3 next round.`;
    const targets =
      s.phase === "expand"
        ? working()
            .filter((m) => m.type === "place" && m.tile === tile)
            .map((m) => m.cell)
        : actualTargets();
    play.innerHTML = `<header class="game-header"><div class="brand">${btn("🏝️ Vanuatu", "data-boardgame", "wordmark")}<div class="game-credits"><span>Designed by Alain Epron</span><span>Published by Quined Games</span></div></div><div class="round-track" aria-label="${t("round")} ${s.round}/8">${Array.from({ length: 8 }, (_, i) => `<span title="${t("round")} ${i + 1}/8" class="${i + 1 === s.round ? "current" : i + 1 < s.round ? "past" : ""}">${i + 1}</span>`).join("")}</div><nav class="header-tools">${analysis || !options.chat ? "" : titled(t("chat"), `${icon("chat")}<span class="unread-badge" hidden></span>`, 'data-activity="chat"', "icon-button")}${titled(t("journal"), icon("journal"), 'data-activity="journal"', "icon-button")}${titled(t("colorBlind"), icon("colorBlind"), `data-color-blind aria-pressed="${colorBlind}"`, "icon-button")}${titled(t("help"), icon("help"), "data-help", "icon-button")}${titled(t("full"), icon("fullscreen"), "data-fullscreen", "icon-button")}</nav></header>
  <div class="table">${dock()}<section class="sea-board" style="--ocean:url('${assets.ocean}')"><div class="sea-dashboard"><div class="market-info"><span class="fish-price" title="${esc(marketHelp)}">${icon("fish", marketHelp)} = ${token("coin", s.market, marketHelp)}</span><span title="${t("tourist")}">${token("tourist", s.tourists, `${"Tourists available this round"}: ${s.tourists}`)}</span>${s.waterCountdown !== null ? `<span title="${t("waterLeft")}">${token("water", s.waterCountdown, `${t("waterLeft")}: ${s.waterCountdown}`)}</span>` : ""}</div>${tradeShips()}</div><div class="map-scroll ${zoom ? "zoomed" : ""}">${boardSvg(s, { player, colorBlind, overview, language: lang, selected, targets, hoverTile: s.phase === "expand" ? tile : null, t })}</div><div class="map-tools">${titled(overview ? "Focus on placed tiles" : "Show full board", icon("overview"), `data-overview aria-pressed="${overview}"`, "icon-button")}${titled(zoom ? t("fit") : t("zoom"), icon(zoom ? "eye" : "zoom"), "data-zoom", "icon-button")}</div>${s.upcoming.length && s.phase !== "expand" ? titled(t("next"), `${s.upcoming.map((id) => `<img src="${assets[TILES[id].art]}" alt="">`).join("")}${icon("zoom", t("next"))}`, "data-upcoming", "upcoming") : ""}${trayHtml}</section></div><section class="players">${s.players.map(playerCard).join("")}</section><footer class="play-footer"><span title="${"Automatic conversion"}">${token("coin", 10)} → ${token("point", 5)}</span>${btn(t("help"), "data-help", "text-button")}</footer>`;
    observeTray();
    const newScroll = play.querySelector(".map-scroll");
    if (newScroll) {
      newScroll.scrollLeft = sx;
      newScroll.scrollTop = sy;
    }
    if (focus)
      play
        .querySelector(`[data-action="${focus}"]`)
        ?.focus({ preventScroll: true });
    activity.update(s, analysis, colorBlind);
    updateUnread();
  }
  function updateUnread() {
    const n = options.chat?.snapshot.unreadIds.length ?? 0;
    const badge = play.querySelector(".unread-badge");
    if (badge) {
      badge.textContent = n;
      badge.hidden = !n;
    }
    activity.setUnread(n);
  }
  const offChat = options.chat?.subscribe(updateUnread);
  function showDialog(html) {
    focusReturn = document.activeElement;
    dialog.innerHTML = `<button type="button" class="dialog-close icon-button" data-close aria-label="${t("cancel")}">${icon("close")}</button>${html}`;
    if (!dialog.open) dialog.showModal();
  }
  function closeDialog() {
    dialog.close();
    focusReturn?.isConnected && focusReturn.focus({ preventScroll: true });
  }
  async function send(m) {
    if (!m || pending || !enabled) return;
    moveSound.unlock();
    pending = true;
    feedback.hidden = true;
    render();
    try {
      await options.onMove?.(m);
      void moveSound.play();
      selected = null;
      action = null;
      draft = [];
      closeDialog();
    } catch (e) {
      feedback.textContent = e?.message ?? String(e);
      feedback.hidden = false;
    } finally {
      pending = false;
      render();
    }
  }
  function cellClick(id) {
    if (s.phase === "expand") {
      if (working().some((m) => m.cell === id && m.tile === tile))
        selected = id;
    } else if (actualTargets().includes(id)) selected = id;
    else {
      const b = s.board[id];
      if (b?.type === "island")
        showDialog(
          `<h2>${t("island")}</h2><div class="island-detail"><img src="${assets[TILES[b.id].art]}" alt=""><div>${token("build", `${b.huts.length}/${TILES[b.id].huts}`)} ${token("tourist", `${b.tourists}/${TILES[b.id].tourists}`)} ${token("draw", `${b.drawings}/${TILES[b.id].drawings}`)}<p>${Object.entries(
            b.goods,
          )
            .map(([g, n]) => token(g, n))
            .join("")}</p></div></div>`,
        );
    }
    if (s.phase === "expand") render();
    else renderControls();
  }
  for (const event of ["pointerover", "pointerout"])
    root.addEventListener(
      event,
      (e) => {
        const cell = e.target.closest(".map-cell[data-cell]");
        if (!cell || cell.contains(e.relatedTarget)) return;
        play
          .querySelector(`[data-highlight-cell="${cell.dataset.cell}"]`)
          ?.classList.toggle("hovered", event === "pointerover");
      },
      listener,
    );
  root.addEventListener(
    "click",
    (e) => {
      const button = e.target.closest("button");
      const cell = e.target.closest("[data-cell]");
      if (cell) {
        cellClick(cell.dataset.cell);
        return;
      }
      if (!button || button.disabled) return;
      const d = button.dataset;
      if ("upcoming" in d) {
        showDialog(
          `<h2>${t("next")}</h2><div class="upcoming-details">${s.upcoming
            .map(
              (id) =>
                `<div class="tile-preview">${tilePreviewSvg(id, { t, colorBlind, language: lang })}</div>`,
            )
            .join("")}</div>`,
        );
        return;
      }
      if ("unavailable" in d) {
        showDialog(`<h2>${t(d.action)}</h2><p>${esc(d.unavailable)}</p>`);
        return;
      }
      if ("move" in d) {
        send(s.legal[Number(d.move)]);
        return;
      }
      if ("bgsPlayer" in d) {
        options.onOpenPlayer?.(Number(d.bgsPlayer));
        return;
      }
      if ("boardgame" in d) {
        options.onOpenBoardgame?.();
        return;
      }
      if ("close" in d) {
        closeDialog();
        return;
      }
      if ("action" in d) {
        if (["plan", "neutral"].includes(s.phase)) {
          draft.push(d.action);
          if (s.phase === "neutral")
            draft.sort((a, b) => ACTIONS.indexOf(a) - ACTIONS.indexOf(b));
          renderControls();
          return;
        } else {
          action = d.action;
          selected = null;
          const targets = actualTargets();
          if (targets.length === 1) selected = targets[0];
        }
        renderControls();
        return;
      }
      if ("undo" in d) {
        draft.pop();
        renderControls();
        return;
      }
      if ("tile" in d) {
        tile = d.tile;
        selected = null;
        render();
        return;
      }
      if ("cancel" in d) {
        action = null;
        selected = null;
        renderControls();
        return;
      }
      if ("overview" in d) {
        overview = !overview;
        zoom = false;
        render();
        play.querySelector("[data-overview]").focus({ preventScroll: true });
        return;
      }
      if ("zoom" in d) {
        zoom = !zoom;
        if (zoom) overview = false;
        render();
        play.querySelector("[data-zoom]").focus({ preventScroll: true });
        return;
      }
      if ("characterChoice" in d) {
        const m = s.legal.find(
          (m) => m.type === "character" && m.character === d.characterChoice,
        );
        showDialog(
          `<div class="character-detail"><img src="${assets["character-" + CHARACTERS[m.character].art]}" alt=""><div><h2>${charName(m.character)}</h2><p>${charHelp(m.character)}</p>${moveButton(m, true)}</div></div>`,
        );
        return;
      }
      if ("character" in d) {
        showDialog(
          `<div class="character-detail"><img src="${assets["character-" + CHARACTERS[d.character].art]}" alt=""><div><h2>${charName(d.character)}</h2><p>${charHelp(d.character)}</p><small>${"Once per round."}</small></div></div>`,
        );
        return;
      }
      if ("free" in d) {
        showDialog(
          `<h2>${t(d.free)}</h2><div class="move-options">${legal()
            .filter((m) => m.type === d.free)
            .map((m) => moveButton(m, true))
            .join("")}</div>`,
        );
        return;
      }
      if ("governor" in d) {
        showDialog(
          `<h2>${t("governor")}</h2><div class="move-options">${working()
            .filter((m) => m.type === "governor")
            .map((m) => moveButton(m, true))
            .join("")}</div>`,
        );
        return;
      }
      if ("activity" in d) {
        activity.open(d.activity);
        return;
      }
      if ("colorBlind" in d) {
        colorBlind = !colorBlind;
        options.onPreference?.("colorBlind", colorBlind);
        render();
        play
          .querySelector("[data-color-blind]")
          ?.focus({ preventScroll: true });
        return;
      }
      if ("fullscreen" in d) {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else root.requestFullscreen?.().catch(() => {});
        return;
      }
      if ("help" in d) {
        showDialog(
          `<h2>${t("help")}</h2><div class="preferences"><label><input type="checkbox" data-pref="colorBlind" ${colorBlind ? "checked" : ""}>${t("colorBlind")}</label><label><input type="checkbox" data-pref="sound" ${sound ? "checked" : ""}>${t("sound")}</label>${
            hostedLocale
              ? ""
              : `<select data-language aria-label="Language">${Object.entries(
                  languages,
                )
                  .map(
                    ([locale, name]) =>
                      `<option value="${locale}" ${lang === locale ? "selected" : ""}>${name}</option>`,
                  )
                  .join("")}</select>`
          }</div>${rulesHtml(lang)}<hr><h3>${t("credit")}</h3><p>Alain Epron · <a href="https://www.quined.nl/featured_item/vanuatu-2nd-edition/" target="_blank" rel="noopener">Quined Games</a><br>Art: Konstantin Vohwinkel · Rafaël Theunis</p><p><a href="https://codeberg.org/boardgamers/vanuatu" target="_blank" rel="noopener">${t("source")}</a></p>`,
        );
        return;
      }
      if ("scores" in d) {
        showDialog(
          `<h2>${t("ended")}</h2><div class="final-scores">${[...s.players]
            .map((p, i) => ({ ...p, i }))
            .sort((a, b) => b.score - a.score)
            .map(
              (p) =>
                `<div style="--player:${p.color}"><b>${esc(p.name)}</b>${token("point", p.score)}${
                  p.final
                    ? `<small>${Object.entries(p.final)
                        .filter(([, v]) => v !== 0)
                        .map(([k, v]) =>
                          token(
                            {
                              wealth: "coin",
                              treasure: "explore",
                              tourists: "tourist",
                              first: "first",
                              water: "water",
                            }[k],
                            v,
                          ),
                        )
                        .join(" · ")}</small>`
                    : ""
                }</div>`,
            )
            .join("")}</div>`,
        );
      }
    },
    listener,
  );
  root.addEventListener(
    "change",
    (e) => {
      if (e.target.matches("[data-bonus]")) {
        bonus = e.target.checked;
        renderControls();
      }
      if (e.target.matches("[data-pref]")) {
        const key = e.target.dataset.pref,
          value = e.target.checked;
        if (key === "colorBlind") colorBlind = value;
        if (key === "sound") {
          sound = value;
          moveSound.setEnabled(value);
          moveSound.unlock();
        }
        options.onPreference?.(key, value);
        render();
      }
      if (e.target.matches("[data-language]")) {
        lang = e.target.value;
        t = translator(lang);
        closeDialog();
        activity.setLanguage(lang);
        render();
        options.onPreference?.("language", lang);
      }
    },
    listener,
  );
  root.addEventListener(
    "keydown",
    (e) => {
      const cell = e.target.closest("[data-cell]");
      if (cell && ["Enter", " "].includes(e.key)) {
        e.preventDefault();
        cellClick(cell.dataset.cell);
      }
    },
    listener,
  );
  dialog.addEventListener(
    "click",
    (e) => {
      if (e.target === dialog && e.offsetX >= 0 && e.offsetY >= 0) {
        const r = dialog.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          closeDialog();
      }
    },
    listener,
  );
  return {
    root,
    render(state) {
      const next = `${state.historyLength ?? state.round + ":" + state.phase}:${player}`;
      if (next !== revision) {
        selected = null;
        action = null;
        draft = [];
        revision = next;
      }
      s = state;
      render();
    },
    setPlayer(p) {
      if (player !== p) {
        player = p;
        draft = [];
        action = null;
        selected = null;
      }
      render();
    },
    setEnabled(v) {
      enabled = v;
      render();
    },
    setPreferences(p) {
      analysis = p.analysis === true;
      colorBlind = p.colorBlind === true;
      sound = p.sound === true;
      moveSound.setEnabled(sound);
      for (const [name, value] of Object.entries({ colorBlind, sound })) {
        const checkbox = dialog.querySelector(`[data-pref="${name}"]`);
        if (checkbox) checkbox.checked = value;
      }
      hostedLocale = typeof p.locale === "string";
      if (hostedLocale || typeof p.language === "string") {
        lang = resolveLocale(p.locale ?? p.language);
        t = translator(lang);
        activity.setLanguage(lang);
      }
      render();
    },
    destroy() {
      events.abort();
      trayObserver.disconnect();
      moveSound.destroy();
      offChat?.();
      activity.destroy();
      root.remove();
    },
  };
}

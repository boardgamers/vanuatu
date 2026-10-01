export function playerColorState(state, preferred = [], colorBlind = false) {
  if (!state) return state;
  return {
    ...state,
    players: state.players.map((player, index) => ({
      ...player,
      color:
        !colorBlind && /^#[a-f0-9]{6}$/i.test(preferred[index] ?? "")
          ? preferred[index]
          : player.color,
    })),
  };
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (values) =>
  values.reduce((total, channel, i) => {
    const c = channel / 255;
    return (
      total +
      (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][i]
    );
  }, 0);
export const playerColorText = (hex) =>
  luminance(rgb(hex)) > 0.179 ? "#000" : "#fff";
export function playerColorInk(hex) {
  let values = rgb(hex);
  while (luminance(values) > 0.13)
    values = values.map((v) => Math.floor(v * 0.8));
  return "#" + values.map((v) => v.toString(16).padStart(2, "0")).join("");
}

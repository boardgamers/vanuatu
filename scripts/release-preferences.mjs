export const mapViewPreference = {
  name: "mapView",
  label: "2D / 3D",
  type: "select",
  default: "3d",
  items: [
    { name: "2d", label: "2D" },
    { name: "3d", label: "3D" },
  ],
};

export function releasePreferences(existing) {
  const preferences = existing.filter(
    ({ name }) => name !== "animations" && name !== "mapView",
  );
  if (!preferences.some(({ name }) => name === "sound"))
    preferences.push({
      name: "sound",
      label: "Game sounds",
      type: "checkbox",
      default: true,
    });
  return [...preferences, mapViewPreference];
}

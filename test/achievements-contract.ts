import type { Engine } from "@boardgamers/protocol/engine";
import { achievementDefinitions, achievements } from "../engine/index.js";

// Compile against the published engine contract, not a local schema copy.
const hooks = { achievementDefinitions, achievements } satisfies Pick<
  Engine,
  "achievementDefinitions" | "achievements"
>;
void hooks;

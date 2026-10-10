import type { AdvNode, CharacterCommand, CharacterDefinition, GameDefinition } from "../types.js";
import type { ScenarioCatalogEntry } from "../scenario-catalog.js";

export type ScenarioDiagnosticSeverity = "error" | "warning";

export interface ScenarioDiagnostic {
  severity: ScenarioDiagnosticSeverity;
  scenarioId: string;
  location?: string;
  message: string;
}

export interface ScenarioValidationResult {
  diagnostics: ScenarioDiagnostic[];
  errors: number;
  warnings: number;
  valid: boolean;
}

export type ValidatableScenario = ScenarioCatalogEntry & { order?: number };

/** Validate catalog metadata and references without loading browser or renderer code. */
export function validateScenarios(
  scenarios: readonly ValidatableScenario[],
): ScenarioValidationResult {
  const diagnostics: ScenarioDiagnostic[] = [];
  const add = (
    severity: ScenarioDiagnosticSeverity,
    scenarioId: string,
    message: string,
    location?: string,
  ) => diagnostics.push({ severity, scenarioId, ...(location ? { location } : {}), message });

  const ids = new Map<string, number>();
  const orders = new Map<number, string[]>();
  for (const item of scenarios) {
    ids.set(item.id, (ids.get(item.id) ?? 0) + 1);
    const order = item.order ?? item.entry.scenario?.order;
    if (typeof order === "number" && Number.isFinite(order)) {
      orders.set(order, [...(orders.get(order) ?? []), item.id]);
    }
  }
  for (const [id, count] of ids) {
    if (count > 1) add("error", id, `duplicate scenario id "${id}"`);
  }
  for (const [order, orderedIds] of orders) {
    if (orderedIds.length > 1) {
      for (const id of orderedIds) add("warning", id, `duplicate scenario order ${order}`);
    }
  }

  for (const item of scenarios) validateScenario(item, add);

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.length - errors;
  return { diagnostics, errors, warnings, valid: errors === 0 };
}

type AddDiagnostic = (
  severity: ScenarioDiagnosticSeverity,
  scenarioId: string,
  message: string,
  location?: string,
) => void;

function validateScenario(item: ValidatableScenario, add: AddDiagnostic): void {
  const { id, entry } = item;
  const game: GameDefinition = entry;
  const title = item.title ?? game.scenario?.title;
  if (typeof title !== "string" || !title.trim()) add("error", id, "missing scenario title");

  const sceneIds = new Set(Object.keys(game.scenes ?? {}));
  if (!game.start || !sceneIds.has(game.start)) {
    add("error", id, `start scene "${game.start ?? ""}" does not exist`, "start");
  }

  const characters = new Map<string, (typeof game.characters)[number]>();
  for (const character of game.characters ?? []) {
    if (!characters.has(character.id)) characters.set(character.id, character);
  }
  for (const character of characters.values()) {
    if (character.defaultExpression) {
      validateAssetReference(id, character.id, character.defaultExpression, "expression", characters, `characters.${character.id}`, add);
    }
  }

  for (const [layoutId, layout] of Object.entries(game.stageLayouts ?? {})) {
    for (const [memberIndex, member] of layout.members.entries()) {
      if (!characters.has(member.character)) {
        add("error", id, `unknown character "${member.character}" in layout "${layoutId}"`, `stageLayouts.${layoutId}.members[${memberIndex}]`);
      }
    }
  }

  const nodes = new Map<string, AdvNode>();
  for (const [sceneId, scene] of Object.entries(game.scenes ?? {})) {
    scene.forEach((node, index) => nodes.set(nodeKey(sceneId, index), node));
  }

  for (const [sceneId, scene] of Object.entries(game.scenes ?? {})) {
    scene.forEach((node, index) => {
      const location = `${sceneId}[${index}]`;
      validatePresentation(item, node, location, characters, add);
      for (const command of commandsOf(node)) {
        validateCharacterCommand(item, command, location, characters, add);
      }
      if (node.type === "choice") {
        node.options.forEach((option, optionIndex) => {
          validateTarget(item, option.next, `${location}.options[${optionIndex}]`, sceneIds, sceneLengths(game), add);
        });
      } else if (node.type === "jump") {
        validateTarget(item, node.next, location, sceneIds, sceneLengths(game), add);
      } else if ("next" in node && node.next) {
        validateTarget(item, node.next, location, sceneIds, sceneLengths(game), add);
      }
    });
  }

  validateGraph(item, nodes, sceneLengths(game), add);
}

function sceneLengths(game: GameDefinition): Map<string, number> {
  return new Map(Object.entries(game.scenes ?? {}).map(([id, nodes]) => [id, nodes.length]));
}

function validatePresentation(
  item: ValidatableScenario,
  node: AdvNode,
  location: string,
  characters: Map<string, (typeof item.entry.characters)[number]>,
  add: AddDiagnostic,
): void {
  const game = item.entry;
  if ((node.type === "line" || node.type === "scene") && node.layout && !game.stageLayouts?.[node.layout]) {
    add("error", item.id, `unknown layout "${node.layout}"`, location);
  }
  if (node.type === "scene" && node.background && !Object.hasOwn(game.backgrounds ?? {}, node.background)) {
    add("error", item.id, `unknown background "${node.background}"`, location);
  }
  if (node.type !== "line") return;

  if (node.speaker && !characters.has(node.speaker)) {
    add("error", item.id, `unknown character "${node.speaker}"`, location);
  }
  if (node.speaker && node.expression) {
    validateAssetReference(item.id, node.speaker, node.expression, "expression", characters, location, add);
  }
  if (node.speaker && node.motion) {
    validateAssetReference(item.id, node.speaker, node.motion, "motion", characters, location, add);
  }
}

function validateCharacterCommand(
  item: ValidatableScenario,
  command: CharacterCommand,
  location: string,
  characters: Map<string, (typeof item.entry.characters)[number]>,
  add: AddDiagnostic,
): void {
  if (!characters.has(command.character)) {
    add("error", item.id, `unknown character "${command.character}"`, location);
    return;
  }
  if (command.expression) {
    validateAssetReference(item.id, command.character, command.expression, "expression", characters, location, add);
  }
  if (command.motion) {
    validateAssetReference(item.id, command.character, command.motion, "motion", characters, location, add);
  }
}

function validateAssetReference(
  scenarioId: string,
  characterId: string,
  assetId: string,
  kind: "expression" | "motion",
  characters: Map<string, CharacterDefinition>,
  location: string,
  add: AddDiagnostic,
): void {
  const character = characters.get(characterId);
  const assets = character?.assets;
  if (!assets) {
    add("error", scenarioId, `unknown ${kind} "${assetId}" for character "${characterId}"`, location);
    return;
  }
  const registry = kind === "expression"
    ? (assets.expressions && typeof assets.expressions === "object" ? assets.expressions : assets)
    : assets.motions;
  if (!registry || typeof registry !== "object" || !Object.hasOwn(registry, assetId)) {
    add("error", scenarioId, `unknown ${kind} "${assetId}" for character "${characterId}"`, location);
  }
}

function validateTarget(
  item: ValidatableScenario,
  target: string,
  location: string,
  sceneIds: Set<string>,
  lengths: Map<string, number>,
  add: AddDiagnostic,
): void {
  const hashIndex = target.indexOf("#");
  const sceneId = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const indexText = hashIndex >= 0 ? target.slice(hashIndex + 1) : "0";
  const nodeIndex = Number(indexText);
  if (!sceneIds.has(sceneId)) {
    add("error", item.id, `unknown target scene "${sceneId}"`, location);
  } else if (!Number.isInteger(nodeIndex) || nodeIndex < 0) {
    add("error", item.id, `invalid target index in "${target}"`, location);
  } else if (nodeIndex > (lengths.get(sceneId) ?? 0)) {
    // A jump beyond the scene's last node is legal at runtime and ends the scenario.
  }
}

function validateGraph(
  item: ValidatableScenario,
  nodes: Map<string, AdvNode>,
  lengths: Map<string, number>,
  add: AddDiagnostic,
): void {
  const sceneIds = new Set(lengths.keys());
  if (!item.entry.start || !sceneIds.has(item.entry.start)) return;

  const start = nodeKey(item.entry.start, 0);
  const reachable = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const key = queue.shift()!;
    if (reachable.has(key)) continue;
    reachable.add(key);
    const node = nodes.get(key);
    if (!node) continue; // Scene exhaustion is a valid terminal state.
    for (const target of outgoingTargets(key, node, lengths)) {
      if (!target || !lengths.has(splitNodeKey(target)[0])) continue;
      if (!reachable.has(target)) queue.push(target);
    }
  }

  for (const sceneId of sceneIds) {
    if (![...reachable].some((key) => key.startsWith(`${sceneId}#`))) {
      add("warning", item.id, `scene "${sceneId}" is unreachable`, sceneId);
    }
  }

  const canTerminate = new Set<string>();
  for (const [key, node] of nodes) {
    if (node.type === "end" || isNaturalEnd(key, node, lengths)) canTerminate.add(key);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, node] of nodes) {
      if (!reachable.has(key) || canTerminate.has(key)) continue;
      if (outgoingTargets(key, node, lengths).some((target) => edgeTerminates(target, lengths) || (!!target && canTerminate.has(target)))) {
        canTerminate.add(key);
        changed = true;
      }
    }
  }
  for (const key of reachable) {
    const node = nodes.get(key);
    if (node && !canTerminate.has(key)) {
      add("error", item.id, "reachable path cannot reach scenario termination", displayNodeKey(key));
    }
  }
}

function outgoingTargets(key: string, node: AdvNode, lengths: Map<string, number>): (string | undefined)[] {
  const [sceneId, indexText] = splitNodeKey(key);
  const index = Number(indexText);
  const nextSequential = (): string | undefined => {
    const nextIndex = index + 1;
    return nextIndex >= (lengths.get(sceneId) ?? 0) ? undefined : nodeKey(sceneId, nextIndex);
  };
  if (node.type === "end") return [];
  if (node.type === "jump") return [targetKey(node.next)];
  if (node.type === "choice") return node.options.map((option) => targetKey(option.next));
  if ("next" in node && node.next) return [targetKey(node.next)];
  return [nextSequential()];
}

function isNaturalEnd(key: string, node: AdvNode, lengths: Map<string, number>): boolean {
  if (node.type === "end" || node.type === "jump" || node.type === "choice") return false;
  const [sceneId, indexText] = splitNodeKey(key);
  return Number(indexText) + 1 >= (lengths.get(sceneId) ?? 0) && !("next" in node && node.next);
}

function targetKey(target: string): string | undefined {
  const hashIndex = target.indexOf("#");
  const sceneId = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const indexText = hashIndex >= 0 ? target.slice(hashIndex + 1) : "0";
  const index = Number(indexText);
  return Number.isInteger(index) && index >= 0 ? nodeKey(sceneId, index) : undefined;
}

function edgeTerminates(target: string | undefined, lengths: Map<string, number>): boolean {
  if (target === undefined) return true;
  const [sceneId, indexText] = splitNodeKey(target);
  const length = lengths.get(sceneId);
  return length !== undefined && Number(indexText) >= length;
}

function nodeKey(sceneId: string, index: number): string {
  return `${sceneId}#${index}`;
}

function splitNodeKey(key: string): [string, string] {
  const index = key.lastIndexOf("#");
  return [key.slice(0, index), key.slice(index + 1)];
}

function displayNodeKey(key: string): string {
  const [sceneId, index] = splitNodeKey(key);
  return `${sceneId}[${index}]`;
}

function commandsOf(node: AdvNode): readonly CharacterCommand[] {
  return node.type === "scene" || node.type === "line" ? node.commands ?? [] : [];
}

import type { AdvNode, GameDefinition } from "../types.js";
export interface ScenarioStatistics { scenes: number; lines: number; characters: number; choices: number; branches: number; textCharacters: number; approximateReadingMinutes: number; }
/** Total authored text across all branches, using a caller-adjustable characters/minute estimate. */
export function scenarioStatistics(game: GameDefinition, charactersPerMinute = 500): ScenarioStatistics {
  if (!Number.isFinite(charactersPerMinute) || charactersPerMinute <= 0) throw new TypeError("Reading speed must be positive.");
  const nodes = Object.values(game.scenes).flat();
  let lines = 0, choices = 0, branches = 0, textCharacters = 0;
  for (const node of nodes) {
    if (node.type === "line") { lines++; textCharacters += [...node.text].length; }
    if (node.type === "choice") { choices++; branches += node.options.length; textCharacters += [...(node.prompt ?? "")].length + node.options.reduce((total, option) => total + [...option.text].length, 0); }
  }
  return { scenes: Object.keys(game.scenes).length, lines, characters: game.characters.length, choices, branches, textCharacters,
    approximateReadingMinutes: Math.ceil(textCharacters / charactersPerMinute * 10) / 10 };
}
export interface ScenarioGraphNode { id: string; type: AdvNode["type"] | "terminal"; }
export interface ScenarioGraphEdge { from: string; to: string; kind: "next" | "choice" | "fallthrough"; }
export interface ScenarioGraph { start: string; nodes: ScenarioGraphNode[]; edges: ScenarioGraphEdge[]; }
/** IDs and node kinds only. Dialogue, choice labels and asset paths are excluded. */
export function scenarioGraph(game: GameDefinition): ScenarioGraph {
  const nodes: ScenarioGraphNode[] = [], edges: ScenarioGraphEdge[] = [];
  const normalize = (target: string): string => target.includes("#") ? `${target.slice(0,target.indexOf("#"))}#${Number(target.slice(target.indexOf("#")+1))}` : `${target}#0`;
  for (const [sceneId, scene] of Object.entries(game.scenes)) {
    scene.forEach((node, index) => {
      const from = `${sceneId}#${index}`; nodes.push({ id: from, type: node.type });
      if (node.type === "end") return;
      if (node.type === "choice") for (const option of node.options) edges.push({ from, to: normalize(option.next), kind: "choice" });
      else if ("next" in node && node.next) edges.push({ from, to: normalize(node.next), kind: "next" });
      else edges.push({ from, to: `${sceneId}#${index+1}`, kind: "fallthrough" });
    });
    nodes.push({ id: `${sceneId}#${scene.length}`, type: "terminal" });
  }
  const known = new Set(nodes.map(n => n.id));
  for (const edge of edges) if (!known.has(edge.to)) { const separator = edge.to.indexOf("#"); const id = edge.to.slice(0,separator), index = Number(edge.to.slice(separator+1));
    if (Object.hasOwn(game.scenes,id) && Number.isInteger(index) && index >= game.scenes[id]!.length) { nodes.push({id:edge.to,type:"terminal"});known.add(edge.to); }
  }
  return { start: `${game.start}#0`, nodes, edges };
}
export function scenarioGraphDot(game: GameDefinition): string {
  const graph = scenarioGraph(game), quote = JSON.stringify;
  return ["digraph scenario {", ...graph.nodes.map(n => `  ${quote(n.id)} [label=${quote(n.type)}];`),
    ...graph.edges.map(e => `  ${quote(e.from)} -> ${quote(e.to)} [label=${quote(e.kind)}];`), "}"].join("\n") + "\n";
}

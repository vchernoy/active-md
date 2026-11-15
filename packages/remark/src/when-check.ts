import { DEFAULT_LIMITS, type Program } from '@vchernoy/calc';

export type WhenCheck = { expression: string; deps: ReadonlySet<string> };
export type ControlCheck = { name: string; ancestors: readonly number[] };
export type WhenProblem = { index: number; severity: 'error' | 'warning'; message: string };

/** Static reachability only, with a shared budget and cached definition/expression closures. */
export function checkWhenControls(program: Program, blocks: readonly WhenCheck[], controls: readonly ControlCheck[], maxSteps = DEFAULT_LIMITS.maxSteps): WhenProblem[] {
  if (!blocks.length || !controls.length) return [];
  let used = 0, index = 0;
  const exhausted = new Error('analysis budget');
  const step = () => { if (++used > maxSteps) throw exhausted; };
  try {
    const problems: WhenProblem[] = [];
    const inputs = new Set(program.inputs.map(i => i.name));
    // A gate blocks an input only when it encloses every control of that input.
    const blockers = new Map<string, Set<number>>();
    for (const control of controls) {
      step();
      if (!inputs.has(control.name)) continue;
      const prior = blockers.get(control.name);
      const gates = new Set<number>();
      for (const id of control.ancestors) { step(); if (!prior || prior.has(id)) gates.add(id); }
      blockers.set(control.name, gates);
    }
    if (![...blockers.values()].some(gates => gates.size)) return [];
    // Definitions are in topological order. Reuse each closure instead of walking
    // the same chain separately for every condition in an untrusted document.
    const closures = new Map<string, Set<string>>();
    for (const def of program.definitions) {
      step();
      const found = new Set<string>();
      if (def.kind === 'input') found.add(def.name);
      for (const dep of def.deps) {
        step();
        for (const name of closures.get(dep) ?? []) { step(); found.add(name); }
      }
      closures.set(def.name, found);
    }
    const expressions = new Map<string, Set<string>>();
    const graph: Set<number>[] = [];
    for (index = 0; index < blocks.length; index++) {
      step();
      const block = blocks[index]!;
      const refs: string[] = [];
      for (const ref of block.deps) { step(); refs.push(ref); }
      const key = JSON.stringify(refs);
      let deps = expressions.get(key);
      if (!deps) {
        deps = new Set();
        for (const ref of refs) for (const name of closures.get(ref) ?? []) { step(); deps.add(name); }
        expressions.set(key, deps);
      }
      const edges = new Set<number>();
      for (const name of deps) {
        step();
        const gates = blockers.get(name);
        if (gates?.has(index)) problems.push({ index, severity: 'error', message: `${name} can hide its own only control: :::when[${block.expression}] depends on ${name} (including dependencies through definitions)` });
        for (const gate of gates ?? []) { step(); if (gate !== index) edges.add(gate); }
      }
      graph.push(edges);
    }
    // Iterative DFS; a cycle is a warning, not proof of a dead end.
    const color = new Uint8Array(blocks.length);
    for (let start = 0; start < blocks.length; start++) {
      step(); index = start;
      if (color[start]) continue;
      color[start] = 1;
      const stack = [{ index: start, edges: graph[start]!.values() }];
      while (stack.length) {
        step();
        const top = stack[stack.length - 1]!;
        index = top.index;
        const next = top.edges.next();
        if (next.done) { color[top.index] = 2; stack.pop(); continue; }
        if (color[next.value] === 1) problems.push({ index, severity: 'warning', message: 'cycle between :::when blocks and their controlling inputs; visibility may leave no accessible control' });
        else if (!color[next.value]) {
          color[next.value] = 1;
          stack.push({ index: next.value, edges: graph[next.value]!.values() });
        }
      }
    }
    return problems;
  } catch (error) {
    if (error !== exhausted) throw error;
    return [{ index: Math.min(index, blocks.length - 1), severity: 'error', message: `conditional control analysis took too many steps (limit ${maxSteps})` }];
  }
}

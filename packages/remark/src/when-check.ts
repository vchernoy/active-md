import type { Program } from '@vchernoy/calc';

export type WhenCheck = { expression: string; deps: ReadonlySet<string> };
export type ControlCheck = { name: string; ancestors: readonly number[] };
export type WhenProblem = { index: number; severity: 'error' | 'warning'; message: string };

/** Static reachability only: never attempts to solve a condition or evaluate document code. */
export function checkWhenControls(program: Program, blocks: readonly WhenCheck[], controls: readonly ControlCheck[]): WhenProblem[] {
  const problems: WhenProblem[] = [];
  const definitions = new Map(program.definitions.map(d => [d.name, d]));
  const inputs = new Set(program.inputs.map(i => i.name));
  const dependencies = blocks.map(block => {
    const reached = new Set<string>();
    const pending = [...block.deps];
    while (pending.length) {
      const name = pending.pop()!;
      if (reached.has(name)) continue;
      reached.add(name);
      for (const dep of definitions.get(name)?.deps ?? []) pending.push(dep);
    }
    return [...reached].filter(name => inputs.has(name));
  });
  // A gate blocks an input only when it encloses every control of that input.
  const blockers = new Map<string, Set<number>>();
  for (const control of controls) {
    if (!inputs.has(control.name)) continue;
    const prior = blockers.get(control.name);
    blockers.set(control.name, prior
      ? new Set(control.ancestors.filter(id => prior.has(id)))
      : new Set(control.ancestors));
  }
  const graph = dependencies.map((deps, index) => {
    const edges = new Set<number>();
    for (const name of deps) {
      const gates = blockers.get(name);
      if (gates?.has(index)) problems.push({ index, severity: 'error', message: `${name} can hide its own only control: :::when[${blocks[index]!.expression}] depends on ${name} (including dependencies through definitions)` });
      for (const gate of gates ?? []) if (gate !== index) edges.add(gate);
    }
    return edges;
  });
  // Iterative DFS, linear in the graph size; cycles are warnings, not dead-end proofs.
  const color = new Uint8Array(blocks.length);
  for (let start = 0; start < blocks.length; start++) {
    if (color[start]) continue;
    color[start] = 1;
    const stack = [{ index: start, edges: [...graph[start]!][Symbol.iterator]() }];
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const next = top.edges.next();
      if (next.done) { color[top.index] = 2; stack.pop(); continue; }
      if (color[next.value] === 1) {
        problems.push({ index: top.index, severity: 'warning', message: 'cycle between :::when blocks and their controlling inputs; visibility may leave no accessible control' });
      } else if (!color[next.value]) {
        color[next.value] = 1;
        stack.push({ index: next.value, edges: [...graph[next.value]!][Symbol.iterator]() });
      }
    }
  }
  return problems;
}

// Timing helper for the performance tests. Not used by the app.

interface CpuUsage {
  user: number;
  system: number;
}

interface NodeProcess {
  cpuUsage?: () => CpuUsage;
  threadCpuUsage?: () => CpuUsage;
}

// The project has no @types/node, so reach Node's process through a narrow cast. Prefer the
// calling thread's CPU time (Node 23.9+): the process total also counts V8's background GC and
// compiler threads, which run concurrently and can add more CPU time than the code itself used.
const nodeProcess = (globalThis as { process?: NodeProcess }).process;
const readCpuUsage = nodeProcess?.threadCpuUsage?.bind(nodeProcess) ?? nodeProcess?.cpuUsage?.bind(nodeProcess);

/**
 * Milliseconds `run` takes, measured as CPU time (user + system) when Node exposes it, else as
 * wall-clock time.
 *
 * CPU time is used because the full suite runs Vitest workers in parallel (and the gate or other
 * builds may run cargo alongside): wall-clock time also counts the time this thread sits
 * descheduled while other processes hold the CPU, which says nothing about this code.
 */
export function timeMs(run: () => unknown): number {
  if (readCpuUsage) {
    const start = readCpuUsage();
    run();
    const end = readCpuUsage();
    return (end.user - start.user + end.system - start.system) / 1000;
  }
  const start = performance.now();
  run();
  return performance.now() - start;
}

/**
 * Best `timeMs` of `run`, retrying until one pass fits `budgetMs` or `maxWallMs` of wall-clock
 * time has gone by. Callers should do an untimed warm-up pass first so the JIT has compiled the
 * hot loops.
 *
 * Retrying over a time window rather than a fixed count matters because CPU time is not fully
 * immune to machine load: a saturated machine (shared hyperthreaded cores, memory bandwidth,
 * lower boost clocks) makes the same work cost several times more CPU time. That load is bursty,
 * so a window of passes almost always catches a quiet stretch, while code that is really over
 * budget still fails every pass.
 */
export function bestTimeMs(run: () => unknown, budgetMs: number, maxWallMs = 30_000): number {
  const deadline = performance.now() + maxWallMs;
  let best = Infinity;
  do {
    best = Math.min(best, timeMs(run));
  } while (best >= budgetMs && performance.now() < deadline);
  return best;
}

export type LatexBlockSyncSchedulerOptions<T> = {
  schedule: (callback: () => void) => number;
  cancel: (handle: number) => void;
  synchronize: (blocks: readonly T[]) => void;
};

/** Batches repeated DOM changes so each affected formula block syncs once per frame. */
export function createLatexBlockSyncScheduler<T>({
  schedule,
  cancel,
  synchronize,
}: LatexBlockSyncSchedulerOptions<T>) {
  const pending = new Set<T>();
  let handle: number | null = null;
  let destroyed = false;

  const flush = () => {
    handle = null;
    if (destroyed || pending.size === 0) return;
    const blocks = [...pending];
    pending.clear();
    synchronize(blocks);
  };

  return {
    enqueue(block: T) {
      if (destroyed) return;
      pending.add(block);
      if (handle === null) handle = schedule(flush);
    },
    destroy() {
      destroyed = true;
      if (handle !== null) cancel(handle);
      handle = null;
      pending.clear();
    },
  };
}

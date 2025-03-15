import { WalkerState, Dirent } from "../../types";

export type WalkDirectoryFunction = (
  state: WalkerState,
  crawlPath: string,
  directoryPath: string,
  depth: number,
  callback: (entries: Dirent[], directoryPath: string, depth: number) => void
) => void;

const readdirOpts = { withFileTypes: true } as const;

const walkAsync: WalkDirectoryFunction = (
  state,
  crawlPath,
  directoryPath,
  currentDepth,
  callback
) => {
  if (currentDepth < 0) return state.queue.dequeue(null, state);

  state.visited.push(crawlPath);
  state.counts.directories++;
  state.queue.enqueue();

  // Get the file system implementation to use
  const fileSystem = state.options.fileSystem;

  // Perf: Node >= 10 introduced withFileTypes that helps us
  // skip an extra fs.stat call.
  fileSystem.readdir(crawlPath || ".", readdirOpts, (error, entries = []) => {
    callback(entries, directoryPath, currentDepth);

    state.queue.dequeue(state.options.suppressErrors ? null : error, state);
  });
};

const walkSync: WalkDirectoryFunction = (
  state,
  crawlPath,
  directoryPath,
  currentDepth,
  callback
) => {
  if (currentDepth < 0) return;
  state.visited.push(crawlPath);
  state.counts.directories++;

  // Get the file system implementation to use
  const fileSystem = state.options.fileSystem;

  let entries: Dirent[] = [];
  try {
    entries = fileSystem.readdirSync(crawlPath || ".", readdirOpts);
  } catch (e) {
    if (!state.options.suppressErrors) throw e;
  }
  callback(entries, directoryPath, currentDepth);
};

export function build(isSynchronous: boolean): WalkDirectoryFunction {
  return isSynchronous ? walkSync : walkAsync;
}

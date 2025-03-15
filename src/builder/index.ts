import { sep } from "pathe";
import {
  Output,
  OnlyCountsOutput,
  GroupOutput,
  PathsOutput,
  Options,
  FilterPredicate,
  ExcludePredicate,
  GlobFunction,
  GlobParams,
  FileSystemInterface,
} from "../types";
import { APIBuilder } from "./api-builder";
import pm from "picomatch";
import type { Matcher } from "picomatch";

function defaults<T extends Record<string, any>>(userOptions: Partial<T>, defaultOptions: Partial<T>): T {
  const result = { ...userOptions };
  
  for (const key in defaultOptions) {
    if (
      Object.prototype.hasOwnProperty.call(defaultOptions, key) && 
      defaultOptions[key] !== undefined && 
      result[key] === undefined
    ) {
      result[key] = defaultOptions[key];
    }
  }
  
  return result as T;
}

export class Builder<
  TReturnType extends Output = PathsOutput,
  TGlobFunction = typeof pm
> {
  private readonly globCache: Record<string, Matcher> = {};
  private options: Options<TGlobFunction>
  private globFunction?: TGlobFunction;

  constructor(options: Partial<Options<TGlobFunction>> & { fileSystem: FileSystemInterface }) {
    this.options = defaults<Options<TGlobFunction>>(options, {
      maxDepth: Infinity,
      suppressErrors: true,
      pathSeparator: sep,
      filters: []
    });
    
    this.globFunction = this.options.globFunction;
  }

  group(): Builder<GroupOutput, TGlobFunction> {
    this.options.group = true;
    return this as Builder<GroupOutput, TGlobFunction>;
  }

  withPathSeparator(separator: "/" | "\\") {
    this.options.pathSeparator = separator;
    return this;
  }

  withBasePath() {
    this.options.includeBasePath = true;
    return this;
  }

  withRelativePaths() {
    this.options.relativePaths = true;
    return this;
  }

  withDirs() {
    this.options.includeDirs = true;
    return this;
  }

  withMaxDepth(depth: number) {
    this.options.maxDepth = depth;
    return this;
  }

  withMaxFiles(limit: number) {
    this.options.maxFiles = limit;
    return this;
  }

  withFullPaths() {
    this.options.resolvePaths = true;
    this.options.includeBasePath = true;
    return this;
  }

  withErrors() {
    this.options.suppressErrors = false;
    return this;
  }

  withSymlinks({ resolvePaths = true } = {}) {
    this.options.resolveSymlinks = true;
    this.options.useRealPaths = resolvePaths;
    return this.withFullPaths();
  }

  withAbortSignal(signal: AbortSignal) {
    this.options.signal = signal;
    return this;
  }

  normalize() {
    this.options.normalizePath = true;
    return this;
  }

  filter(predicate: FilterPredicate) {
    this.options.filters.push(predicate);
    return this;
  }

  onlyDirs() {
    this.options.excludeFiles = true;
    this.options.includeDirs = true;
    return this;
  }

  exclude(predicate: ExcludePredicate) {
    this.options.exclude = predicate;
    return this;
  }

  onlyCounts(): Builder<OnlyCountsOutput, TGlobFunction> {
    this.options.onlyCounts = true;
    return this as Builder<OnlyCountsOutput, TGlobFunction>;
  }

  crawl(root?: string) {
    return new APIBuilder<TReturnType>(root || ".", this.options);
  }

  withGlobFunction<TFunc>(fn: TFunc) {
    // cast this since we don't have the new type params yet
    this.globFunction = fn as unknown as TGlobFunction;
    return this as unknown as Builder<TReturnType, TFunc>;
  }

  /**
   * @deprecated Pass options using the constructor instead:
   * ```ts
   * new fdir(options).crawl("/path/to/root");
   * ```
   * This method will be removed in v7.0
   */
  /* c8 ignore next 4 */
  crawlWithOptions(root: string, options: Partial<Options<TGlobFunction>>) {
    this.options = { ...this.options, ...options };
    return new APIBuilder<TReturnType>(root || ".", this.options);
  }

  glob(...patterns: string[]) {
    if (this.globFunction) {
      return this.globWithOptions(patterns);
    }
    return this.globWithOptions(
      patterns,
      ...[{dot: true}] as unknown as GlobParams<TGlobFunction>
    );
  }

  globWithOptions(patterns: string[]): Builder<TReturnType, TGlobFunction>;
  globWithOptions(patterns: string[], ...options: GlobParams<TGlobFunction>): Builder<TReturnType, TGlobFunction>;
  globWithOptions(patterns: string[], ...options: GlobParams<TGlobFunction>|[]) {
    const globFn = (this.globFunction || pm) as GlobFunction | null;
    /* c8 ignore next 5 */
    if (!globFn) {
      throw new Error(
        'Please specify a glob function to use glob matching.'
      );
    }

    var isMatch = this.globCache[patterns.join("\0")];
    if (!isMatch) {
      isMatch = globFn(patterns, ...options);
      this.globCache[patterns.join("\0")] = isMatch;
    }
    this.options.filters.push((path) => isMatch(path));
    return this;
  }
}

// worker_threads spawns a brand-new module-loader realm that does not
// inherit the main thread's tsx hook, so a worker pointed straight at
// census-worker.ts fails with ERR_UNKNOWN_FILE_EXTENSION or
// ERR_MODULE_NOT_FOUND depending on how it's asked to load it -- neither
// `--import tsx/esm` nor calling node:module's `register()` from inside the
// worker gets tsx's transform hook to actually engage there (tsx's
// auto-register only fires for the main thread). This is a plain,
// already-valid .mjs file (needs no transform itself) that uses tsx's
// `tsImport()` API -- built exactly for loading a single TS file on demand,
// no global hook registration required -- to load the real (TypeScript)
// worker logic.
import { tsImport } from "tsx/esm/api";

await tsImport("./census-worker.ts", import.meta.url);

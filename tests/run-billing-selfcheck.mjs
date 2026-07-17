// Registers the @/ alias loader then runs the billing self-check.
// Run: node tests/run-billing-selfcheck.mjs
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./tests/alias-loader.mjs", pathToFileURL("./"));
await import("./billing-selfcheck.mjs");

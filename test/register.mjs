import { register } from "node:module";

// Registers the extensionless-relative-import resolver used by `node --test`.
// Loaded via `node --import ./test/register.mjs` from the `test` script.
register("./tsExtensionResolver.mjs", import.meta.url);

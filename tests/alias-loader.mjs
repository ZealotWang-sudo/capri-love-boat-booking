import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function resolveAliasPath(specifier) {
  const base = path.join(projectRoot, "src", specifier.slice(2));

  for (const candidate of [base, `${base}.js`, path.join(base, "index.js")]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return base;
}

// Mirrors the `@/*` -> `src/*` alias that Next.js applies via jsconfig.json, so
// tests can import application modules directly.
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(pathToFileURL(resolveAliasPath(specifier)).href, context);
  }

  return nextResolve(specifier, context);
}

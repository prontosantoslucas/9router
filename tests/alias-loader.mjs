import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
const SRC = resolvePath(process.cwd(), "src");
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const target = pathToFileURL(resolvePath(SRC, specifier.slice(2))).href;
    return next(target, context);
  }
  return next(specifier, context);
}

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validateVersion(pkg, lock, tag) {
  const version = pkg.version;
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("版本号必须是三段稳定版本，例如 0.1.0。");
  }
  if (lock.version !== version || lock.packages?.[""]?.version !== version) {
    throw new Error(
      "package.json 与 package-lock.json 版本不一致，请使用 npm version --no-git-tag-version 更新。",
    );
  }
  if (tag && tag !== `v${version}`)
    throw new Error(`标签 ${tag} 与 package.json 的 v${version} 不一致。`);
  return version;
}

export function readVersion(tag) {
  return validateVersion(
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url))),
    JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url))),
    tag,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const tag =
    process.argv[2] ||
    (process.env.GITHUB_REF_TYPE === "tag"
      ? process.env.GITHUB_REF_NAME
      : undefined);
  console.log(readVersion(tag));
}

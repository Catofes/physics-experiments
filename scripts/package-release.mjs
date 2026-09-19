import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readVersion } from "./version.mjs";

const version = readVersion();
const info = JSON.parse(readFileSync("dist/version.json", "utf8"));
if (info.version !== version)
  throw new Error("dist 版本过期，请先运行 npm run build。");
const image =
  process.env.RELEASE_IMAGE || "ghcr.io/catofes/physics-experiments";
if (!/^[a-z0-9][a-z0-9./_-]*$/.test(image))
  throw new Error("RELEASE_IMAGE 必须是小写镜像仓库名，不包含标签。");
const name = `physics-experiments-${version}`;
const temp = mkdtempSync(join(tmpdir(), "physics-release-"));
const stage = join(temp, name);
mkdirSync(stage);
mkdirSync("release", { recursive: true });
try {
  cpSync("dist", join(stage, "dist"), { recursive: true });
  cpSync("docs", join(stage, "docs"), { recursive: true });
  for (const [from, to] of [
    ["Caddyfile", "Caddyfile"],
    ["deploy/Dockerfile", "Dockerfile"],
    ["deploy/README.md", "README.md"],
  ])
    cpSync(from, join(stage, to));
  writeFileSync(
    join(stage, "compose.yaml"),
    `services:\n  physics-experiments:\n    image: ${image}:${version}\n    build: .\n    ports:\n      - "\${PORT:-8080}:8080"\n    restart: unless-stopped\n`,
  );
  const filename = `${name}.tar.gz`;
  execFileSync("tar", ["-czf", resolve("release", filename), "-C", temp, name]);
  const checksum = createHash("sha256")
    .update(readFileSync(`release/${filename}`))
    .digest("hex");
  writeFileSync("release/SHA256SUMS", `${checksum}  ${filename}\n`);
  console.log(`已生成 release/${filename} 和 release/SHA256SUMS`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

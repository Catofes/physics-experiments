import { execFileSync } from "node:child_process";
import { readVersion } from "./version.mjs";

function git(...args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function buildInfo() {
  const revision =
    process.env.BUILD_REVISION || git("rev-parse", "HEAD") || "unknown";
  if (!/^(?:[a-f0-9]{7,40}|unknown)$/.test(revision))
    throw new Error("BUILD_REVISION 必须是 Git 提交 SHA 或 unknown。");
  const epoch =
    process.env.SOURCE_DATE_EPOCH || git("show", "-s", "--format=%ct", "HEAD");
  if (epoch && !/^\d+$/.test(epoch))
    throw new Error("SOURCE_DATE_EPOCH 必须是 Unix 秒时间戳。");
  return {
    version: readVersion(),
    revision,
    builtAt: new Date(epoch ? Number(epoch) * 1000 : Date.now()).toISOString(),
  };
}

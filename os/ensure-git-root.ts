import {existsSync} from "fs";
import {execSync} from "child_process";

export function ensureGitRoot() {
  // should check if cwd is not git root then print warning and cwd.
  // else just print cwd.
  // must be synchronous to work inside synchronous createApp
  const cwd = process.cwd();
  const dot = cwd + '/.git';
  const hasDotGit = existsSync(dot);
  if (hasDotGit) {
    console.log({cwd});
    return;
  }
  let root = '';
  try {
    root = execSync('git rev-parse --show-toplevel').toString().trim();
  } catch {
  }
  if (root && root !== cwd) {
    console.log('not git root', {cwd, root});
  } else {
    console.log({cwd});
  }
}

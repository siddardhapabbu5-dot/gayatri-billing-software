import { spawn, execSync } from "node:child_process";
import process from "node:process";

const PORT = Number(process.env.PORT || 5177);

function pidsOnPort(port) {
  const isWin = process.platform === "win32";
  // Match :5177 but not :51770 / :51779
  const portRe = new RegExp(`:${port}(?:\\s|$)`);
  try {
    if (isWin) {
      const out = execSync("netstat -ano", { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/i.test(line) || !portRe.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        if (pid > 0) pids.add(pid);
      }
      return [...pids];
    }
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: "utf8" });
    return out
      .split(/\s+/)
      .map((s) => Number(s))
      .filter((n) => n > 0);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    return true;
  } catch {
    return false;
  }
}

const existing = pidsOnPort(PORT);
for (const pid of existing) {
  if (pid === process.pid) continue;
  const ok = killPid(pid);
  console.log(ok ? `Freed port ${PORT} (stopped PID ${pid})` : `Could not stop PID ${pid}`);
}

if (existing.length) {
  try {
    if (process.platform === "win32") {
      execSync("powershell -NoProfile -Command \"Start-Sleep -Milliseconds 500\"", { stdio: "ignore" });
    } else {
      execSync("sleep 0.5", { stdio: "ignore" });
    }
  } catch {
    /* ignore */
  }
}

const child = spawn(
  process.execPath,
  ["./node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"],
  { stdio: "inherit", cwd: process.cwd() },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

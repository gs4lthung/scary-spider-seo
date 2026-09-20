// OpenNext removes its output directory before every build. On Windows, a
// local workerd preview can keep files in that directory open, so release
// only this project's preview workers before starting a new build.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function stopLocalPreviewWorkers() {
  if (process.platform !== "win32") {
    return;
  }

  const projectPath = process.cwd().replaceAll("'", "''");
  const command = `$root = '${projectPath}'; Get-CimInstance Win32_Process -Filter "Name = 'workerd.exe'" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like "$root*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;

  execFileSync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    command,
  ], { stdio: "ignore" });
}

stopLocalPreviewWorkers();

const openNextCli = fileURLToPath(new URL(
  "../node_modules/@opennextjs/cloudflare/dist/cli/index.js",
  import.meta.url,
));
execFileSync(process.execPath, [openNextCli, "build"], {
  stdio: "inherit",
});

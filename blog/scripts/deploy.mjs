// Runs the full blog deploy: remote D1 migrations, then build + Cloudflare
// Workers deploy. Fails fast on the first error instead of half-deploying.
// Usage: npm run deploy
import { execSync } from "node:child_process";

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit" });
}

try {
  execSync("npx wrangler whoami", { stdio: "pipe" }).toString();
} catch {
  console.error("Not logged in to Cloudflare. Run `npx wrangler login` first, then re-run `npm run deploy`.");
  process.exit(1);
}

run("npm run db:migrate:remote");
run("npm run cf:deploy");

console.log("\nDeployed. https://blog.scaryspiderseo.com");

// Runs the API and the Vite dev server together: `bun run dev`.
const api = Bun.spawn(["bun", "run", "--watch", "src/server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});
const web = Bun.spawn(["bunx", "vite"], { stdout: "inherit", stderr: "inherit" });
const stop = () => {
  api.kill();
  web.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race([api.exited, web.exited]);
stop();

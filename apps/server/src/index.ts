import { createApp } from "./app.js";

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return 4000;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    console.error(`[server] invalid PORT "${raw}" — must be an integer 0-65535`);
    process.exit(1);
  }
  return n;
}

const PORT = parsePort(process.env.PORT);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const { httpServer, io } = createApp({ corsOrigin: WEB_ORIGIN });

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[server] port ${PORT} is already in use`);
  } else {
    console.error("[server] http server error:", err);
  }
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`[server] wordspy server listening on :${PORT}`);
  console.log(`[server] CORS / Socket.IO origin: ${WEB_ORIGIN}`);
  console.log(`[server] health: http://localhost:${PORT}/health`);
});

// Graceful shutdown — Railway/Render send SIGTERM on deploy/restart.
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received — shutting down`);
  io.close(() => {
    httpServer.close(() => {
      console.log("[server] closed cleanly");
      process.exit(0);
    });
  });
  // Hard-exit safety net if close hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaught exception:", err);
  process.exit(1);
});

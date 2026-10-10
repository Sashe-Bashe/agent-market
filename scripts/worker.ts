import "dotenv/config";
import { runOneJob } from "../src/lib/engine";
import { providerInfo } from "../src/lib/provider";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log(
  `Agent Market worker ready (${providerInfo().provider}); concurrency 3, durable SQLite jobs.`,
);
async function loop() {
  while (!stopping) {
    try {
      await Promise.all([runOneJob(), runOneJob(), runOneJob()]);
    } catch {
      console.error("Worker iteration failed; durable jobs will be retried.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
void loop();

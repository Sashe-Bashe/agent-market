import { seed, resetDemo } from "../src/lib/db";
if (process.argv.includes("--reset-demo")) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo reset disabled in production");
  resetDemo();
  console.log(
    "Explicit demo requests, offers and orders reset; seeded stock restored. Catalogue edits preserved.",
  );
} else {
  seed();
  console.log("Demo accounts and catalogue ready. Existing data preserved.");
}

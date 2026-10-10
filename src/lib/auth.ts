import { createHash, randomBytes } from "node:crypto";
import { db, now } from "./db";
import { accountFor, AppError } from "./service";
export const demoEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function newSession(accountId: string) {
  if (!demoEnabled())
    throw new AppError("Local demo sign-in is disabled in production", 403);
  const account = accountFor(accountId);
  const row = db
    .prepare("SELECT demo FROM workspaces WHERE id=?")
    .get(account.workspaceId) as { demo: number };
  if (!row.demo)
    throw new AppError(
      "Only seeded demonstration accounts may be selected",
      403,
    );
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
    digest(token),
    account.id,
    account.workspaceId,
    new Date(Date.now() + 86400000).toISOString(),
  );
  return token;
}
export function sessionActor(token?: string) {
  if (!token || !demoEnabled())
    throw new AppError("Select a local demo account to continue", 401);
  const row = db
    .prepare(
      "SELECT user_id,workspace_id FROM sessions WHERE token_hash=? AND expires_at>?",
    )
    .get(digest(token), now()) as
    | { user_id: string; workspace_id: string }
    | undefined;
  if (!row)
    throw new AppError("Demo session expired. Select an account again", 401);
  const actor = accountFor(row.user_id);
  if (actor.workspaceId !== row.workspace_id)
    throw new AppError("Session workspace is unavailable", 401);
  return actor;
}
export function accounts() {
  if (!demoEnabled()) return [];
  return (
    db
      .prepare(
        "SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id JOIN workspaces w ON w.id=m.workspace_id WHERE u.demo=1 AND w.demo=1 ORDER BY CASE WHEN m.role='buyer' THEN 0 ELSE 1 END,u.id",
      )
      .all() as { id: string }[]
  ).map(({ id }) => accountFor(id));
}

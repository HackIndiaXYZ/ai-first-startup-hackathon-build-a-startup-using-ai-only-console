import { AppError, checkOrigin, db, json } from "@/lib/store";
import { hashText, identity, issueSession, pharmaFailure, pharmaSession, requestBody, requireRole, secretToken } from "@/lib/pharma/store";
import type { PharmaRole } from "@/lib/pharma/types";

const roles: PharmaRole[] = ["viewer", "operations", "quality", "admin"];
type TeamChange = { actor: string; role: PharmaRole; action: string; entity: string; before: string; after: string };
const adminGuard = "EXISTS(SELECT 1 FROM pharma_members actor JOIN pharma_workspaces scope ON scope.id=actor.workspace_id WHERE actor.workspace_id=? AND actor.user_id=? AND actor.role='admin' AND scope.revision=?)";

/** The revision and audit are conditional on the preceding membership/invitation mutation.
 * D1 batch executes these statements atomically. A denied/no-op mutation changes neither. */
async function commitAccessChange(workspaceId: string, statements: D1PreparedStatement[], event: TeamChange) {
  const mutation = crypto.randomUUID(), now = new Date().toISOString(), id = crypto.randomUUID();
  const audit = JSON.stringify({ id, at: now, actor: event.actor, role: event.role, action: `team.${event.action}`, entity: event.entity, reason: "Explicit organisation access decision", before: event.before, after: event.after });
  const result = await db().batch([
    ...statements,
    db().prepare("UPDATE pharma_workspaces SET revision=revision+1,mutation=?,updated_at=? WHERE id=? AND changes()>0").bind(mutation, now, workspaceId),
    db().prepare("INSERT INTO pharma_records(workspace_id,collection,record_id,data,position) SELECT ?,'audit',?,?,(SELECT COALESCE(MAX(position),-1)+1 FROM pharma_records WHERE workspace_id=? AND collection='audit') WHERE EXISTS(SELECT 1 FROM pharma_workspaces WHERE id=? AND mutation=?)").bind(workspaceId, id, audit, workspaceId, workspaceId, mutation),
  ]);
  if (!result[0].meta.changes || result[statements.length].meta.changes !== 1 || result[statements.length + 1].meta.changes !== 1) throw new AppError("The invitation, membership or your access changed. Refresh before retrying.", 409);
}

export async function GET(req: Request) {
  try {
    const { workspace, access } = await pharmaSession(req);
    const members = await db().prepare("SELECT user_id AS userId,email,name,role,joined_at AS joinedAt FROM pharma_members WHERE workspace_id=? ORDER BY joined_at").bind(workspace.id).all();
    const invitations = access.role === "admin" ? await db().prepare("SELECT email,role,expires_at AS expiresAt FROM pharma_invitations WHERE workspace_id=? AND accepted_by IS NULL AND expires_at>?").bind(workspace.id, new Date().toISOString()).all() : { results: [] };
    return json({ members: members.results, invitations: invitations.results, access });
  } catch (error) { return pharmaFailure(error); }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const body = await requestBody(req);
    if (!body || typeof body !== "object") throw new AppError("Provide a supported organisation access action.");
    const user = identity(req);
    if (!user) throw new AppError("Sign in with ChatGPT to manage an organisation workspace.", 401);
    if (body.type === "accept") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) throw new AppError("This invitation is invalid.");
      const tokenHash = await hashText(body.token), now = new Date().toISOString();
      const invitation = await db().prepare("SELECT invite.workspace_id,invite.email,invite.role,scope.revision FROM pharma_invitations invite JOIN pharma_workspaces scope ON scope.id=invite.workspace_id WHERE invite.token_hash=? AND invite.accepted_by IS NULL AND invite.expires_at>? AND scope.owner_id IS NOT NULL").bind(tokenHash, now).first<{ workspace_id: string; email: string; role: PharmaRole; revision: number }>();
      if (!invitation || invitation.email !== user.email || !roles.includes(invitation.role)) throw new AppError("This invitation is expired, already accepted or belongs to a different email address.", 403);
      const member = await db().prepare("SELECT role FROM pharma_members WHERE workspace_id=? AND user_id=?").bind(invitation.workspace_id, user.id).first();
      if (member) throw new AppError("You already belong to this workspace. Ask an administrator to change your existing role.", 409);
      await commitAccessChange(invitation.workspace_id, [
        db().prepare("INSERT INTO pharma_members(workspace_id,user_id,email,name,role,joined_at) SELECT invite.workspace_id,?,?,?,invite.role,? FROM pharma_invitations invite JOIN pharma_workspaces scope ON scope.id=invite.workspace_id WHERE invite.token_hash=? AND invite.email=? AND invite.accepted_by IS NULL AND invite.expires_at>? AND scope.revision=? AND scope.owner_id IS NOT NULL ON CONFLICT(workspace_id,user_id) DO NOTHING").bind(user.id, user.email, user.name, now, tokenHash, user.email, now, invitation.revision),
        db().prepare("UPDATE pharma_invitations SET accepted_by=? WHERE token_hash=? AND email=? AND accepted_by IS NULL AND expires_at>? AND changes()>0").bind(user.id, tokenHash, user.email, now),
      ], { actor: user.name, role: invitation.role, action: "accept", entity: user.id, before: "Not a member", after: invitation.role });
      return json({ accepted: true }, 200, await issueSession(req, invitation.workspace_id));
    }
    const { workspace, access } = await pharmaSession(req);
    requireRole(access, ["admin"]);
    if (body.type === "claim") {
      if (access.secured) return json({ secured: true, unchanged: true });
      await commitAccessChange(workspace.id, [
        db().prepare("UPDATE pharma_workspaces SET owner_id=? WHERE id=? AND owner_id IS NULL AND revision=?").bind(user.id, workspace.id, workspace.revision),
        db().prepare("INSERT INTO pharma_members(workspace_id,user_id,email,name,role,joined_at) SELECT ?,?,?,?,?,? WHERE changes()>0 ON CONFLICT(workspace_id,user_id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role").bind(workspace.id, user.id, user.email, user.name, "admin", new Date().toISOString()),
      ], { actor: user.name, role: "admin", action: "claim", entity: user.id, before: "Guest workspace", after: "Account-backed organisation" });
      return json({ secured: true });
    }
    if (!access.secured) throw new AppError("Save this workspace to your account before managing a team.");
    if (body.type === "invite") {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 || !roles.includes(body.role)) throw new AppError("Provide a valid email address and workspace role.");
      const email = body.email.toLowerCase(), now = new Date().toISOString();
      const token = secretToken();
      await commitAccessChange(workspace.id, [
        db().prepare(`INSERT INTO pharma_invitations(token_hash,workspace_id,email,role,expires_at) SELECT ?,?,?,?,? WHERE ${adminGuard} AND (SELECT COUNT(*) FROM pharma_invitations WHERE workspace_id=? AND accepted_by IS NULL AND expires_at>?)<20 AND NOT EXISTS(SELECT 1 FROM pharma_invitations WHERE workspace_id=? AND email=? AND accepted_by IS NULL AND expires_at>?) AND NOT EXISTS(SELECT 1 FROM pharma_members WHERE workspace_id=? AND email=?)`).bind(await hashText(token), workspace.id, email, body.role, new Date(Date.now() + 7 * 86400000).toISOString(), workspace.id, user.id, workspace.revision, workspace.id, now, workspace.id, email, now, workspace.id, email),
      ], { actor: user.name, role: "admin", action: "invite", entity: email, before: "No active invitation", after: body.role });
      // An operator decides whether and where to share the link. No email is sent.
      return json({ inviteUrl: `${new URL(req.url).origin}/?invite=${token}`, expiresInDays: 7 });
    }
    if (body.type === "revoke" || body.type === "role") {
      if (typeof body.userId !== "string" || !body.userId || body.userId.length > 200) throw new AppError("Choose a team member.");
      const owner = await db().prepare("SELECT owner_id FROM pharma_workspaces WHERE id=?").bind(workspace.id).first<{ owner_id: string }>();
      if (owner?.owner_id === body.userId) throw new AppError("The workspace owner must retain administrator access.");
      const member = await db().prepare("SELECT role FROM pharma_members WHERE workspace_id=? AND user_id=?").bind(workspace.id, body.userId).first<{ role: PharmaRole }>();
      if (!member) throw new AppError("This member is no longer in the workspace.", 404);
      if (body.type === "role" && !roles.includes(body.role)) throw new AppError("Choose a supported role.");
      if (body.type === "role" && body.role === member.role) return json({ updated: false, unchanged: true });
      const statement = body.type === "role"
        ? db().prepare(`UPDATE pharma_members SET role=? WHERE workspace_id=? AND user_id=? AND role=? AND user_id<>(SELECT owner_id FROM pharma_workspaces WHERE id=?) AND ${adminGuard}`).bind(body.role, workspace.id, body.userId, member.role, workspace.id, workspace.id, user.id, workspace.revision)
        : db().prepare(`DELETE FROM pharma_members WHERE workspace_id=? AND user_id=? AND role=? AND user_id<>(SELECT owner_id FROM pharma_workspaces WHERE id=?) AND ${adminGuard}`).bind(workspace.id, body.userId, member.role, workspace.id, workspace.id, user.id, workspace.revision);
      await commitAccessChange(workspace.id, [statement], { actor: user.name, role: "admin", action: body.type, entity: body.userId, before: member.role, after: body.type === "role" ? body.role : "Membership removed" });
      return json({ updated: true });
    }
    if (body.type === "cancel-invite") {
      if (typeof body.email !== "string" || body.email.length > 254) throw new AppError("Choose an invitation.");
      const email = body.email.toLowerCase();
      await commitAccessChange(workspace.id, [
        db().prepare(`DELETE FROM pharma_invitations WHERE workspace_id=? AND email=? AND accepted_by IS NULL AND ${adminGuard}`).bind(workspace.id, email, workspace.id, user.id, workspace.revision),
      ], { actor: user.name, role: "admin", action: "cancel-invite", entity: email, before: "Pending invitation", after: "Invitation cancelled" });
      return json({ updated: true });
    }
    throw new AppError("Unknown team action.");
  } catch (error) { return pharmaFailure(error); }
}

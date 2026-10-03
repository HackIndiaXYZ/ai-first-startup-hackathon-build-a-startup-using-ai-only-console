import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aiRequestUsage = sqliteTable("ai_request_usage", {
  day: text("day").primaryKey(),
  requests: integer("requests").notNull().default(0),
});

export const pharmaWorkspaces = sqliteTable("pharma_workspaces", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  metadata: text("metadata").notNull(),
  ownerId: text("owner_id"),
  mutation: text("mutation").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pharmaRecords = sqliteTable("pharma_records", {
  workspaceId: text("workspace_id").notNull().references(() => pharmaWorkspaces.id),
  collection: text("collection").notNull(),
  recordId: text("record_id").notNull(),
  position: integer("position").notNull().default(0),
  data: text("data").notNull(),
}, table => [primaryKey({ columns: [table.workspaceId, table.collection, table.recordId] })]);

export const pharmaSessions = sqliteTable("pharma_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => pharmaWorkspaces.id),
  expiresAt: text("expires_at").notNull(),
}, table => [index("idx_pharma_sessions_expiry").on(table.expiresAt)]);

export const pharmaMembers = sqliteTable("pharma_members", {
  workspaceId: text("workspace_id").notNull().references(() => pharmaWorkspaces.id),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  joinedAt: text("joined_at").notNull(),
}, table => [primaryKey({ columns: [table.workspaceId, table.userId] }), index("idx_pharma_members_user").on(table.userId)]);

export const pharmaInvitations = sqliteTable("pharma_invitations", {
  tokenHash: text("token_hash").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => pharmaWorkspaces.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedBy: text("accepted_by"),
}, table => [index("idx_pharma_invitations_workspace").on(table.workspaceId)]);

export const pharmaRequests = sqliteTable("pharma_requests", {
  workspaceId: text("workspace_id").notNull().references(() => pharmaWorkspaces.id),
  requestId: text("request_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  revision: integer("revision").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [primaryKey({ columns: [table.workspaceId, table.requestId] })]);

export const pharmaAiUsage = sqliteTable("pharma_ai_usage", {
  workspaceId: text("workspace_id").notNull().references(() => pharmaWorkspaces.id),
  day: text("day").notNull(),
  requests: integer("requests").notNull().default(0),
}, table => [primaryKey({ columns: [table.workspaceId, table.day] })]);

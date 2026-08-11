import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    receiptHash: text("receipt_hash").notNull().unique(),
    slug: text("slug").notNull().unique(),
    displayName: text("display_name").notNull(),
    contributorName: text("contributor_name").notNull(),
    linkedinUrl: text("linkedin_url"),
    displayLinkedin: integer("display_linkedin", { mode: "boolean" }).notNull().default(false),
    description: text("description").notNull(),
    singaporeConnection: text("singapore_connection").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    rightsAttested: integer("rights_attested", { mode: "boolean" }).notNull().default(false),
    category: text("category").notNull().default("Street Life & Nature"),
    fileKey: text("file_key").notNull(),
    publicFileKey: text("public_file_key"),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    triangleCount: integer("triangle_count").notNull().default(0),
    materialCount: integer("material_count").notNull().default(0),
    animationCount: integer("animation_count").notNull().default(0),
    meshCount: integer("mesh_count").notNull().default(0),
    validationStatus: text("validation_status").notNull(),
    validationChecks: text("validation_checks").notNull(),
    status: text("status").notNull().default("submitted"),
    adminNotes: text("admin_notes").notNull().default(""),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    submitterFingerprint: text("submitter_fingerprint").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    publishedAt: text("published_at"),
    deletionDueAt: text("deletion_due_at"),
  },
  (table) => [
    index("idx_submissions_status_published").on(table.status, table.publishedAt),
    index("idx_submissions_fingerprint_created").on(table.submitterFingerprint, table.createdAt),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    reporterName: text("reporter_name").notNull().default("Anonymous"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("idx_reports_submission_status").on(table.submissionId, table.status)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_audit_submission_created").on(table.submissionId, table.createdAt)],
);

export const likes = sqliteTable(
  "likes",
  {
    assetId: text("asset_id").notNull(),
    voterFingerprint: text("voter_fingerprint").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.assetId, table.voterFingerprint] })],
);

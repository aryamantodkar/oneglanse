import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "./schema";

export type User = InferSelectModel<typeof schema.user>;
export type InsertUser = InferInsertModel<typeof schema.user>;

export type Session = InferSelectModel<typeof schema.session>;
export type InsertSession = InferInsertModel<typeof schema.session>;

export type Account = InferSelectModel<typeof schema.account>;
export type InsertAccount = InferInsertModel<typeof schema.account>;

export type Verification = InferSelectModel<typeof schema.verification>;
export type InsertVerification = InferInsertModel<typeof schema.verification>;

export type Organization = InferSelectModel<typeof schema.organization>;
export type InsertOrganization = InferInsertModel<typeof schema.organization>;

export type Member = InferSelectModel<typeof schema.member>;
export type InsertMember = InferInsertModel<typeof schema.member>;

export type Invitation = InferSelectModel<typeof schema.invitation>;
export type InsertInvitation = InferInsertModel<typeof schema.invitation>;

export type Workspace = InferSelectModel<typeof schema.workspaces>;
export type InsertWorkspace = InferInsertModel<typeof schema.workspaces>;

export type WorkspaceMember = InferSelectModel<typeof schema.workspaceMembers>;
export type InsertWorkspaceMember = InferInsertModel<
  typeof schema.workspaceMembers
>;

export type Competitor = InferSelectModel<typeof schema.competitors>;
export type InsertCompetitor = InferInsertModel<typeof schema.competitors>;

export type CronJob = InferSelectModel<typeof schema.cronJobs>;
export type InsertCronJob = InferInsertModel<typeof schema.cronJobs>;

export type CronQueue = InferSelectModel<typeof schema.cronQueue>;
export type InsertCronQueue = InferInsertModel<typeof schema.cronQueue>;

export type JobRun = InferSelectModel<typeof schema.jobRuns>;
export type InsertJobRun = InferInsertModel<typeof schema.jobRuns>;

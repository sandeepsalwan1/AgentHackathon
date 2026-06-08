export { getSql, hasDatabaseUrl, MissingDatabaseUrlError } from "./connection";
export {
  cleanHostname,
  getClinicById,
  getDefaultClinicContext,
  resolveClinicForHostname,
  resolveClinicId
} from "./clinics";
export type { Clinic, ClinicContext } from "./clinics";
export {
  checkAuthAttemptLimit,
  hashAuthIdentity,
  recordAuthAttempt
} from "./auth";
export {
  createTask,
  editTask,
  getTask,
  listIncompletePriorityTasks,
  listOverdueTasks,
  listTasks,
  renameActorReferences
} from "./tasks";
export {
  archiveCompletedTasksBefore,
  escalateTask,
  transitionTask,
  undoLastStatusChange
} from "./taskTransitions";
export { listTaskEvents } from "./taskAudit";
export {
  createNotificationAttempt,
  markNotificationFailed,
  markNotificationSent,
  markNotificationSkipped
} from "./notifications";
export {
  createAgentReport,
  createAgentRun,
  createAgentToolCall,
  createApproval,
  createWorkflowEvent,
  decideApproval,
  failAgentRun,
  updateAgentRun
} from "./agents";
export {
  getAgentRun,
  getAgentRunWithTimeline,
  listAgentReports,
  listAgentToolCalls,
  listApprovals,
  listWorkflowEvents
} from "./agentTimeline";
export type {
  AgentReport,
  AgentRun,
  AgentRunTimeline,
  AgentToolCall,
  Approval,
  WorkflowEvent
} from "./agents";
export {
  bookMockAppointment,
  listAvailableSlots,
  listOpenFollowups,
  listReviewInvoices,
  markAppointmentArrived,
  markFollowupContacted,
  resetMockClinicState
} from "./mockClinic";
export { listMockClinic } from "./mockClinicSnapshot";
export {
  createPricingObservation,
  listPricingObservations,
  listServiceCatalog
} from "./mockClinicPricing";
export { findArrivalAppointment } from "./mockClinicLookup";
export type {
  MockAppointment,
  MockCallTranscript,
  MockClient,
  MockFollowup,
  MockInvoice,
  MockLabCatalogItem,
  MockLabOrder,
  MockLabResult,
  MockMessage,
  MockPet,
  MockService,
  MockSlot,
  PricingObservation
} from "./mockClinic";
export {
  isPriorityAlertsEnabled,
  deactivateRecipientProfile,
  getRecipientProfile,
  getRecipientProfileByPasscode,
  listRecipientProfiles,
  setRecipientProfile,
  setPriorityAlertsEnabled
} from "./settings";
export type { RecipientProfile } from "./settings";
export type {
  Actor,
  AppRole,
  CreateTaskInput,
  Task,
  TaskEvent,
  TaskPriority,
  TaskRequestType,
  TaskSource,
  TaskStatus,
  UpdateTaskInput
} from "./types";

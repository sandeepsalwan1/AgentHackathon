# Central Veterinary Hospital Context

- Task workflow: rules for task creation, status moves, archive/restore, escalation, assignment side effects, and audit meaning.
- Request intake: public or internal path that accepts clinic work and creates a task.
- Request form: public client UI that collects request intake fields and submits them to request intake.
- Agent tool group: domain-owned agent tool definitions composed by the central agent tool registry.
- Agent clinic data projection: persisted mock clinic/task/approval/report rows shaped for agent runtime input.
- Agent effect persistence: rules that turn agent draft tasks, reports, approvals, workflow events, and tool-call audit into persisted state.
- Operational mutation persistence: rules that turn successful state-changing agent tool calls into mock clinic state changes and linked workflow events.
- Public agent ingress: public workflow request validation, rate limiting, duplicate detection, and guard-event writes before agent execution.
- Veterinarian profile: notification delivery preferences, passcode identity, display name, and actor-reference history.
- Task board projection: role-specific lane membership, visible actions, counts, and display policy for clinic tasks.

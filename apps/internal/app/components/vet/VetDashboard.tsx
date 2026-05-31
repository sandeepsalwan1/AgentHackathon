"use client";

import {
  AlertTriangle,
  BellRing,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ClipboardList,
  FileCheck2,
  FileText,
  Loader2,
  LogOut,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  ReceiptText,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sendVetMessage, type ChatHistoryItem, type ReportSummary } from "../../lib/agentClient";
import { logout, type AccountSession } from "../../lib/accountStore";
import { ChatPanel, type ChatMessage } from "../ChatPanel";

type Props = {
  session: AccountSession;
  onLogout: () => void;
};

type TaskRow = {
  id: string;
  petName: string | null;
  clientName: string | null;
  request: string;
  requestType: string;
  priority: string;
  status: string;
  escalatedAt: string | null;
  dueDate: string;
  dueTime: string;
  createdAt: string;
};

type Stats = {
  dueToday: number;
  dueTodayUrgent: number;
  pendingReview: number;
  pendingReviewUrgent: number;
  escalated: number;
  escalatedUrgent: number;
  completed: number;
};

type Approval = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

const QUICK_ACTIONS = [
  { intent: "daily_ops", label: "Daily ops", icon: ClipboardList },
  { intent: "pricing", label: "Pricing scan", icon: Search },
  { intent: "invoice", label: "Invoice review", icon: ReceiptText },
  { intent: "records", label: "Records", icon: FileCheck2 },
] as const;

const priorityMeta: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "vetPriorityBadge vetPriorityBadge--high" },
  medium: { label: "Medium", cls: "vetPriorityBadge vetPriorityBadge--medium" },
  low: { label: "Low", cls: "vetPriorityBadge vetPriorityBadge--low" },
};

const statusMeta: Record<string, { label: string; cls: string }> = {
  due: { label: "Due", cls: "vetStatusBadge vetStatusBadge--due" },
  pending_review: { label: "Pending Review", cls: "vetStatusBadge vetStatusBadge--review" },
  completed: { label: "Completed", cls: "vetStatusBadge vetStatusBadge--done" },
};

function TaskItem({ task }: { task: TaskRow }) {
  const p = priorityMeta[task.priority] ?? priorityMeta.low;
  const s = statusMeta[task.status] ?? { label: task.status, cls: "vetStatusBadge" };
  const isEscalated = Boolean(task.escalatedAt);
  const time = task.dueTime
    ? new Date(`${task.dueDate}T${task.dueTime}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : new Date(task.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

  return (
    <div className={`vetTaskRow${isEscalated ? " vetTaskRow--escalated" : ""}`}>
      <div className="vetTaskRowMain">
        {isEscalated && <BellRing size={14} className="vetEscalateIcon" />}
        <div className="vetTaskRowPet">{task.petName ?? "—"}</div>
        <div className="vetTaskRowClient">{task.clientName ?? "—"}</div>
      </div>
      <div className="vetTaskRowRequest">{task.request}</div>
      <div className="vetTaskRowMeta">
        <span className={p.cls}>{p.label}</span>
        <span className={s.cls}>{s.label}</span>
        <span className="vetTaskRowTime">{time}</span>
      </div>
    </div>
  );
}

function ReportItem({ report }: { report: ReportSummary }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = report.reportType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const time = new Date(report.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const dataEntries = Object.entries(report.data).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="vetReportItem">
      <div className="vetReportItemHeader" onClick={() => setExpanded((e) => !e)}>
        <div className="vetReportItemMeta">
          <span className="vetReportType">{typeLabel}</span>
          <span className="vetTaskRowTime">{time}</span>
        </div>
        <div className="vetReportItemTitle">{report.title}</div>
        {report.summary && <div className="vetReportItemSummary">{report.summary}</div>}
        <button className="vetReportToggle" type="button">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Hide data" : "View data"}
        </button>
      </div>
      {expanded && dataEntries.length > 0 && (
        <div className="vetReportData">
          {dataEntries.map(([key, value]) => (
            <div key={key} className="vetReportRow">
              <span className="vetReportKey">{key.replace(/_/g, " ")}</span>
              <span className="vetReportValue">
                {typeof value === "object"
                  ? <pre className="vetReportJson">{JSON.stringify(value, null, 2)}</pre>
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsPanel({ reports }: { reports: ReportSummary[] }) {
  return (
    <div className="vetTaskPanel">
      <div className="vetTaskPanelHeader">
        <h2>
          <FileText size={18} />
          Recent Reports
        </h2>
        <span className="vetTaskPanelCount">{reports.length}</span>
      </div>
      <div className="vetReportList">
        {reports.map((r) => (
          <ReportItem key={r.id} report={r} />
        ))}
      </div>
    </div>
  );
}

export function VetDashboard({ session, onLogout }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: `Good morning, Dr. ${session.name.replace(/^Dr\.?\s*/i, "")}. I can help with your daily ops digest, pending approvals, patient records, and more. What would you like to focus on?`,
      status: "completed",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState("");

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [savingApproval, setSavingApproval] = useState("");
  const [reports, setReports] = useState<ReportSummary[]>([]);

  // Load tasks + stats
  useEffect(() => {
    const id = window.setTimeout(() => {
      fetch("/api/agent/vet-tasks")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: { ok: boolean; tasks: TaskRow[]; stats: Stats }) => {
          if (data.ok) {
            setTasks(data.tasks);
            setStats(data.stats);
          }
        })
        .catch(() => {})
        .finally(() => setTasksLoading(false));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Load pending approvals
  useEffect(() => {
    const id = window.setTimeout(() => {
      fetch("/api/agent/vet-approvals")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: { ok: boolean; approvals: Approval[] }) => {
          if (data.ok) setApprovals(data.approvals);
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Load recent reports
  useEffect(() => {
    const id = window.setTimeout(() => {
      fetch("/api/agent/vet-reports")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: { ok: boolean; reports: ReportSummary[] }) => {
          if (data.ok) setReports(data.reports);
        })
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const handleSend = useCallback(
    async (text: string, intent?: string) => {
      const userMessage: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const history: ChatHistoryItem[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await sendVetMessage(session.name, history, text, intent);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: response.message,
            status: response.status,
            approvalIds: response.approvalIds,
            report: response.report,
            timestamp: new Date(),
          },
        ]);
        // Refresh reports panel if a new report was created
        if (response.report) {
          fetch("/api/agent/vet-reports")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data: { ok: boolean; reports: ReportSummary[] }) => {
              if (data.ok) setReports(data.reports);
            })
            .catch(() => {});
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: "Connection issue. Please try again.",
            status: "failed",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, session]
  );

  async function fireQuickAction(intent: string, label: string) {
    setChatOpen(true);
    setQuickLoading(intent);
    try {
      await handleSend(label, intent);
    } finally {
      setQuickLoading("");
    }
  }

  async function decideApproval(id: string, status: "approved" | "rejected") {
    setSavingApproval(id);
    try {
      const res = await fetch(`/api/agent/vet-approve/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      /* silent */
    } finally {
      setSavingApproval("");
    }
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const statCards = stats
    ? [
        {
          label: "Due Today",
          value: stats.dueToday,
          icon: Clock,
          colorClass: "statCard--blue",
          urgent: stats.dueTodayUrgent,
        },
        {
          label: "Pending Review",
          value: stats.pendingReview,
          icon: ClipboardList,
          colorClass: "statCard--amber",
          urgent: stats.pendingReviewUrgent,
        },
        {
          label: "Escalated",
          value: stats.escalated,
          icon: BellRing,
          colorClass: "statCard--red",
          urgent: stats.escalatedUrgent,
        },
        {
          label: "Completed",
          value: stats.completed,
          icon: CheckCircle2,
          colorClass: "statCard--green",
          urgent: 0,
        },
      ]
    : [];

  // Active tasks: not completed, not archived
  const activeTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "archived" && t.status !== "invalid"
  );

  return (
    <div className="vetShell">
      {/* Header */}
      <header className="vetHeader">
        <div className="vetHeaderLeft">
          <Stethoscope size={22} strokeWidth={1.8} />
          <div>
            <p className="vetHeaderEyebrow">Central Veterinary Hospital</p>
            <h1 className="vetHeaderTitle">
              Dr. {session.name.replace(/^Dr\.?\s*/i, "")}
            </h1>
          </div>
        </div>
        <div className="vetHeaderRight">
          <span className="vetHeaderDate">{today}</span>
          <button
            className={`vetChatToggle${chatOpen ? " vetChatToggle--active" : ""}`}
            onClick={() => setChatOpen((o) => !o)}
            title={chatOpen ? "Close AI assistant" : "Open AI assistant"}
          >
            {chatOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            <span>AI Assistant</span>
          </button>
          <button className="iconButton" onClick={handleLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Quick actions toolbar */}
      <div className="vetQuickBar">
        <span className="vetQuickBarLabel">Agent</span>
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const loading = quickLoading === action.intent;
          return (
            <button
              key={action.intent}
              className="vetQuickBtn"
              disabled={Boolean(quickLoading) || isLoading}
              onClick={() => void fireQuickAction(action.intent, action.label)}
              title={`Run ${action.label} agent`}
            >
              {loading ? <Loader2 size={14} className="spinIcon" /> : <Icon size={14} />}
              {action.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className={`vetContent${chatOpen ? (chatExpanded ? " vetContent--withChat--wide" : " vetContent--withChat") : ""}`}>
        <div className="vetMain">

          {/* Stat cards */}
          {tasksLoading ? (
            <div className="vetStats">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="statCard statCard--loading" />
              ))}
            </div>
          ) : (
            <div className="vetStats">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`statCard ${stat.colorClass}`}>
                    <div className="statCardHeader">
                      <Icon size={18} />
                      <span className="statCardLabel">{stat.label}</span>
                    </div>
                    <div className="statCardValue">{stat.value}</div>
                    {stat.urgent > 0 && (
                      <div className="statCardUrgent">
                        <AlertTriangle size={12} />
                        {stat.urgent} urgent
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Task queue */}
          <div className="vetTaskPanel">
            <div className="vetTaskPanelHeader">
              <h2>
                <ClipboardList size={18} />
                Today&apos;s Queue
              </h2>
              {!tasksLoading && (
                <span className="vetTaskPanelCount">{activeTasks.length} tasks</span>
              )}
            </div>

            {tasksLoading ? (
              <div className="vetTaskListLoading">
                <Loader2 size={20} className="spinIcon" />
                <span>Loading tasks…</span>
              </div>
            ) : activeTasks.length === 0 ? (
              <p className="vetTaskPanelNote">No active tasks right now.</p>
            ) : (
              <div className="vetTaskList">
                {activeTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>

          {/* Recent reports */}
          {reports.length > 0 && (
            <ReportsPanel reports={reports} />
          )}

          {/* Pending approvals */}
          {approvals.length > 0 && (
            <div className="vetTaskPanel">
              <div className="vetTaskPanelHeader">
                <h2>
                  <BellRing size={18} />
                  Pending Approvals
                </h2>
                <span className="vetTaskPanelCount">
                  {approvals.length} item{approvals.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="vetTaskList">
                {approvals.map((a) => (
                  <div key={a.id} className="vetTaskRow vetApprovalRow">
                    <div className="vetTaskRowMain">
                      <div className="vetTaskRowPet">{a.title}</div>
                      <span className="vetTaskRowTime">
                        {new Date(a.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="vetTaskRowRequest">{a.summary}</div>
                    <div className="vetApprovalActions">
                      <button
                        className="vetApproveBtn"
                        disabled={Boolean(savingApproval)}
                        onClick={() => void decideApproval(a.id, "approved")}
                      >
                        {savingApproval === a.id ? (
                          <Loader2 size={13} className="spinIcon" />
                        ) : (
                          <Check size={13} />
                        )}
                        Approve
                      </button>
                      <button
                        className="vetRejectBtn"
                        disabled={Boolean(savingApproval)}
                        onClick={() => void decideApproval(a.id, "rejected")}
                      >
                        <X size={13} />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="vetChatPanel">
            <div className="vetChatPanelHeader">
              <Bot size={18} />
              <span>AI Assistant</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                <button
                  className="iconButton"
                  onClick={() => setChatExpanded((e) => !e)}
                  title={chatExpanded ? "Shrink panel" : "Expand panel"}
                >
                  {chatExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
                <button
                  className="iconButton"
                  onClick={() => { setChatOpen(false); setChatExpanded(false); }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              placeholder="Ask about daily digest, approvals, records…"
            />
          </div>
        )}
      </div>
    </div>
  );
}

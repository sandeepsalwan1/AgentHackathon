"use client";

import {
  AlertTriangle,
  BellRing,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  LayoutDashboard,
  Loader2,
  LogOut,
  ReceiptText,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { logout, type AccountSession } from "../../lib/accountStore";
import { sendVetMessage, type ChatHistoryItem } from "../../lib/agentClient";
import { ChatPanel, type ChatMessage } from "../ChatPanel";
import { CreateVetPanel } from "./CreateVetPanel";

type Props = {
  session: AccountSession;
  onLogout: () => void;
  onOpenBoard: () => void;
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

type Tab = "tasks" | "assistant" | "team";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// Agent quick actions run the internal agent for common ops work.
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
        <div className="vetTaskRowPet">{task.petName ?? "No pet"}</div>
        <div className="vetTaskRowClient">{task.clientName ?? "No client"}</div>
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

export function AdminDashboard({ session, onLogout, onOpenBoard }: Props) {
  const [tab, setTab] = useState<Tab>("tasks");

  // Tasks tab state
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksRefreshing, setTasksRefreshing] = useState(false);
  const [newTaskCount, setNewTaskCount] = useState(0);
  const lastTaskCount = useRef(0);

  // Assistant tab state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "I'm the clinic assistant. I can see tasks, approvals, records, invoices, and pricing. Ask for a daily ops digest or anything you want to look into.",
      status: "completed",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState("");

  const fetchTasks = useCallback(async (isManual = false) => {
    if (isManual) setTasksRefreshing(true);
    try {
      const res = await fetch("/api/agent/vet-tasks");
      if (!res.ok) return;
      const data: { ok: boolean; tasks: TaskRow[]; stats: Stats } = await res.json();
      if (!data.ok) return;
      const active = data.tasks.filter(
        (t) => t.status !== "completed" && t.status !== "archived" && t.status !== "invalid"
      );
      if (lastTaskCount.current > 0 && active.length > lastTaskCount.current) {
        setNewTaskCount(active.length - lastTaskCount.current);
      }
      lastTaskCount.current = active.length;
      setTasks(data.tasks);
      setStats(data.stats);
    } catch {
      /* silent */
    } finally {
      setTasksLoading(false);
      if (isManual) setTasksRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void fetchTasks(), 0);
    const interval = window.setInterval(() => void fetchTasks(), 20_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [fetchTasks]);

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
        // The agent may have created tasks; refresh the board.
        void fetchTasks();
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
    [messages, session, fetchTasks]
  );

  async function fireQuickAction(intent: string, label: string) {
    setTab("assistant");
    setQuickLoading(intent);
    try {
      await handleSend(label, intent);
    } finally {
      setQuickLoading("");
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
        { label: "Due Today", value: stats.dueToday, icon: Clock, colorClass: "statCard--blue", urgent: stats.dueTodayUrgent },
        { label: "Pending Review", value: stats.pendingReview, icon: ClipboardList, colorClass: "statCard--amber", urgent: stats.pendingReviewUrgent },
        { label: "Escalated", value: stats.escalated, icon: BellRing, colorClass: "statCard--red", urgent: stats.escalatedUrgent },
        { label: "Completed", value: stats.completed, icon: CheckCircle2, colorClass: "statCard--green", urgent: 0 },
      ]
    : [];

  const activeTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "archived" && t.status !== "invalid"
  );

  return (
    <div className="vetShell">
      <header className="vetHeader">
        <div className="vetHeaderLeft">
          <ShieldMark />
          <div>
            <p className="vetHeaderEyebrow">Central Veterinary Hospital</p>
            <h1 className="vetHeaderTitle">{session.name}</h1>
          </div>
        </div>
        <div className="vetHeaderRight">
          <span className="vetHeaderDate">{today}</span>
          <button className="plainButton adminBoardBtn" onClick={onOpenBoard} title="Open the full task board">
            <LayoutDashboard size={16} />
            Task Board
          </button>
          <button className="iconButton" onClick={handleLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="adminDashTabs">
        <button
          className={`adminDashTab${tab === "tasks" ? " adminDashTab--active" : ""}`}
          onClick={() => { setTab("tasks"); setNewTaskCount(0); }}
          type="button"
        >
          <ClipboardList size={15} />
          Tasks
          {newTaskCount > 0 && tab !== "tasks" && <span className="adminDashTabBadge">+{newTaskCount}</span>}
        </button>
        <button
          className={`adminDashTab${tab === "assistant" ? " adminDashTab--active" : ""}`}
          onClick={() => setTab("assistant")}
          type="button"
        >
          <Bot size={15} />
          AI Assistant
        </button>
        <button
          className={`adminDashTab${tab === "team" ? " adminDashTab--active" : ""}`}
          onClick={() => setTab("team")}
          type="button"
        >
          <Users size={15} />
          Team
        </button>
      </div>

      {/* Tasks tab */}
      {tab === "tasks" && (
        <div className="vetContent">
          <div className="vetMain">
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

            {/* Agent quick actions */}
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
                    title={`Run ${action.label}`}
                  >
                    {loading ? <Loader2 size={14} className="spinIcon" /> : <Icon size={14} />}
                    {action.label}
                  </button>
                );
              })}
            </div>

            <div className="vetTaskPanel">
              <div className="vetTaskPanelHeader">
                <h2>
                  <ClipboardList size={18} />
                  Today&apos;s Queue
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {!tasksLoading && <span className="vetTaskPanelCount">{activeTasks.length} tasks</span>}
                  <button
                    className={`vetRefreshBtn${tasksRefreshing ? " vetRefreshBtn--spinning" : ""}`}
                    onClick={() => void fetchTasks(true)}
                    title="Refresh queue"
                    type="button"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
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
          </div>
        </div>
      )}

      {/* AI Assistant tab */}
      {tab === "assistant" && (
        <div className="adminAssistantWrap">
          <ChatPanel
            messages={messages}
            onSend={(text) => void handleSend(text)}
            isLoading={isLoading}
            placeholder="Ask for a daily digest, records, invoices, pricing…"
          />
        </div>
      )}

      {/* Team tab — account creation */}
      {tab === "team" && (
        <CreateVetPanel session={session} onLogout={handleLogout} onOpenLegacyBoard={onOpenBoard} embedded />
      )}
    </div>
  );
}

function ShieldMark() {
  return <Users size={22} strokeWidth={1.8} />;
}

"use client";

import { AlertCircle, Bot, CheckCircle2, ChevronDown, ChevronUp, Clock, Send, ShieldAlert, User } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReportSummary, WorkflowStatus } from "../lib/agentClient";
import { InvoiceList, type InvoiceData } from "./InvoiceList";
import { DailyOpsSummaryView, type DailyOpsSummary } from "./DailyOpsSummaryView";
import { ApprovalsList, FollowupsList, HighPriorityTaskList, PricingReportsList } from "./DailyOpsDetails";
import { PricingComparisonsList, type PricingComparison } from "./PricingComparisonsList";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: WorkflowStatus;
  timestamp: Date;
  approvalIds?: string[];
  report?: ReportSummary;
};

type Props = {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
};

const statusMeta: Record<WorkflowStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  running: { label: "Running", icon: <Clock size={12} />, cls: "agentChip agentChip--running" },
  needs_approval: { label: "Needs approval", icon: <ShieldAlert size={12} />, cls: "agentChip agentChip--approval" },
  completed: { label: "Completed", icon: <CheckCircle2 size={12} />, cls: "agentChip agentChip--done" },
  failed: { label: "Failed", icon: <AlertCircle size={12} />, cls: "agentChip agentChip--failed" },
};

function StatusChip({ status }: { status: WorkflowStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={meta.cls}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function formatMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

function ReportCard({ report }: { report: ReportSummary }) {
  const [expanded, setExpanded] = useState(false);

  const typeLabel = report.reportType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const SKIP_KEYS = new Set(["services", "flagged", "mode", "changedPrices"]);
  const dataEntries = Object.entries(report.data).filter(
    ([k, v]) => v !== null && v !== undefined && !SKIP_KEYS.has(k)
  );

  return (
    <div className="reportCard">
      <div className="reportCardHeader">
        <span className="reportCardType">{typeLabel}</span>
        <span className="reportCardTitle">{report.title}</span>
      </div>
      {report.summary && (
        <p className="reportCardSummary">{report.summary}</p>
      )}
      {dataEntries.length > 0 && (
        <>
          <button
            className="reportCardToggle"
            onClick={() => setExpanded((e) => !e)}
            type="button"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Hide details" : "View full report"}
          </button>
          {expanded && (
            <div className="reportCardData">
              {dataEntries.map(([key, value]) => {
                if (key === "invoices" && Array.isArray(value)) {
                  return (
                    <div key={key} className="reportCardRowFull">
                      <span className="reportCardKey">{key.replace(/_/g, " ")}</span>
                      <div className="reportCardValue">
                        <InvoiceList invoices={value as InvoiceData[]} />
                      </div>
                    </div>
                  );
                }
                if (key === "summary" && value && typeof value === "object" && !Array.isArray(value)) {
                  return (
                    <div key={key} className="reportCardRowFull">
                      <span className="reportCardKey">{key.replace(/_/g, " ")}</span>
                      <div className="reportCardValue">
                        <DailyOpsSummaryView summary={value as DailyOpsSummary} />
                      </div>
                    </div>
                  );
                }
                if (key === "approvals" && Array.isArray(value)) {
                  return (
                    <div key={key} className="reportCardRowFull">
                      <span className="reportCardKey">{key.replace(/_/g, " ")}</span>
                      <div className="reportCardValue">
                        <ApprovalsList approvals={value} />
                      </div>
                    </div>
                  );
                }
                if (key === "followups" && Array.isArray(value)) {
                  return (
                    <div key={key} className="reportCardRowFull">
                      <span className="reportCardKey">{key.replace(/_/g, " ")}</span>
                      <div className="reportCardValue">
                        <FollowupsList followups={value} />
                      </div>
                    </div>
                  );
                }
                if (key === "highPriority" && Array.isArray(value)) {
                  return (
                    <div key={key} className="reportCardRowFull">
                      <span className="reportCardKey">{key.replace(/_/g, " ")}</span>
                      <div className="reportCardValue">
                        <HighPriorityTaskList tasks={value} />
                      </div>
                    </div>
                  );
                }
                if (key === "pricingReports" && Array.isArray(value)) {
                  return (
                    <div key={key} className="reportCardRowFull">
                      <span className="reportCardKey">{key.replace(/_/g, " ")}</span>
                      <div className="reportCardValue">
                        <PricingReportsList reports={value} />
                      </div>
                    </div>
                  );
                }
                if (key === "comparisons" && Array.isArray(value)) {
                  return (
                    <div key={key} className="reportCardRowFull">
                      <span className="reportCardKey">Pricing comparisons</span>
                      <div className="reportCardValue">
                        <PricingComparisonsList comparisons={value as PricingComparison[]} />
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={key} className="reportCardRow">
                    <span className="reportCardKey">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="reportCardValue">
                      {typeof value === "object"
                        ? <pre className="reportCardJson">{JSON.stringify(value, null, 2)}</pre>
                        : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ChatPanel({ messages, onSend, isLoading, placeholder, className }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed && !isLoading) {
        onSend(trimmed);
        setInput("");
      }
    }
  }

  return (
    <div className={`chatContainer${className ? ` ${className}` : ""}`}>
      <div className="chatMessages">
        {messages.length === 0 && (
          <div className="chatEmpty">
            <Bot size={32} />
            <p>Ask about visits, refills, or records.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chatMessage chatMessage--${msg.role}`}>
            <div className="chatAvatar">
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="chatBubbleWrapper">
              <div
                className="chatBubble"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
              />
              {msg.report && <ReportCard report={msg.report} />}
              {msg.status && msg.status !== "completed" && (
                <div className="chatMeta">
                  <StatusChip status={msg.status} />
                  {msg.status === "needs_approval" && (
                    <span className="chatApprovalNote">
                      A staff member will review and confirm this action.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chatMessage chatMessage--assistant">
            <div className="chatAvatar">
              <Bot size={16} />
            </div>
            <div className="chatBubbleWrapper">
              <div className="chatBubble chatBubble--loading">
                <span className="typingDot" />
                <span className="typingDot" />
                <span className="typingDot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chatComposer" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="chatInput"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Type a message… (Enter to send)"}
          rows={1}
          disabled={isLoading}
        />
        <button
          className="chatSendButton"
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

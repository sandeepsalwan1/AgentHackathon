"use client";

import {
  Calendar,
  ClipboardList,
  FileText,
  HeartPulse,
  LogOut,
  PawPrint,
  Pill,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useState } from "react";
import { sendCustomerMessage, type ChatHistoryItem, type CustomerContext } from "../../lib/agentClient";
import { logout, type AccountSession } from "../../lib/accountStore";
import { ChatPanel, type ChatMessage } from "../ChatPanel";

type Props = {
  session: AccountSession;
  onLogout: () => void;
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

const QUICK_ACTIONS = [
  { label: "Book appointment", prompt: "I'd like to book an appointment for my pet", icon: Calendar, color: "customerQuickBtn--blue" },
  { label: "Check in", prompt: "I'm arriving at the clinic and want to check in", icon: ShieldCheck, color: "customerQuickBtn--green" },
  { label: "Prescription refill", prompt: "I need a prescription refill for my pet", icon: Pill, color: "customerQuickBtn--purple" },
  { label: "Pet records", prompt: "I'd like to access my pet's medical records", icon: FileText, color: "customerQuickBtn--amber" },
  { label: "Pickup status", prompt: "I want to know if my pet is ready for pickup", icon: ClipboardList, color: "customerQuickBtn--teal" },
  { label: "Health concern", prompt: "My pet is unwell and I need some advice", icon: HeartPulse, color: "customerQuickBtn--red" },
] as const;

export function CustomerExperience({ session, onLogout }: Props) {
  const firstName = session.name.split(" ")[0];
  const petName = session.petName ?? "your pet";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: `Hello ${firstName}! 👋 I'm your Central Vet assistant. I can help you book appointments, request prescription refills, check in on arrival, or manage ${petName}'s records. What can I help you with today?`,
      status: "completed",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);

  const handleSend = useCallback(
    async (text: string) => {
      setChatStarted(true);
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
        const ctx: CustomerContext = {
          name: session.name,
          phone: session.phone,
          petName: session.petName,
        };
        const response = await sendCustomerMessage(ctx, history, text);
        const assistantMessage: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: response.message,
          status: response.status,
          approvalIds: response.approvalIds,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: "I'm having trouble connecting right now. Please try again in a moment.",
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

  function handleLogout() {
    logout();
    onLogout();
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="customerShell">
      {/* Header */}
      <header className="customerHeader">
        <div className="customerHeaderBrand">
          <PawPrint size={20} strokeWidth={2} />
          <span className="customerHeaderName">Central Vet</span>
        </div>
        <div className="customerHeaderUser">
          <div className="customerHeaderUserInfo">
            <span className="customerHeaderGreeting">{session.name}</span>
            {session.petName && (
              <span className="customerHeaderPet">
                <PawPrint size={10} />
                {session.petName}
              </span>
            )}
          </div>
          <button className="iconButton customerLogoutBtn" onClick={handleLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="customerMain">
        <div className="customerContent">
          {/* Welcome card */}
          {!chatStarted && (
            <div className="customerWelcomeCard">
              <div className="customerWelcomeLeft">
                <div className="customerWelcomeIcon">
                  <PawPrint size={28} strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="customerWelcomeTitle">
                    Good to see you, {firstName}!
                  </h2>
                  <p className="customerWelcomeDate">{today}</p>
                  {session.petName && (
                    <p className="customerWelcomePet">
                      Caring for <strong>{session.petName}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          {!chatStarted && (
            <div className="customerQuickSection">
              <p className="customerQuickLabel">What can we help with?</p>
              <div className="customerQuickGrid">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      className={`customerQuickBtn ${action.color}`}
                      onClick={() => void handleSend(action.prompt)}
                      disabled={isLoading}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chat */}
          <div className={`customerChatWrapper${chatStarted ? " customerChatWrapper--full" : ""}`}>
            {chatStarted && (
              <div className="customerChatTopBar">
                <button
                  className="customerBackBtn"
                  onClick={() => setChatStarted(false)}
                  type="button"
                >
                  ← Quick actions
                </button>
              </div>
            )}
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              placeholder={`Ask about ${petName}'s appointments, prescriptions, check-in…`}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

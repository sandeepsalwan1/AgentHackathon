"use client";

import { LogOut, PawPrint } from "lucide-react";
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

export function CustomerExperience({ session, onLogout }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: `Hello ${session.name.split(" ")[0]}! 👋 I'm your Central Vet assistant. I can help you book appointments, request prescription refills, check in on arrival, or manage your pet's records. What can I help you with today?`,
      status: "completed",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(
    async (text: string) => {
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
        const ctx: CustomerContext = { name: session.name, phone: session.phone };
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

  return (
    <div className="customerShell">
      <header className="customerHeader">
        <div className="customerHeaderBrand">
          <PawPrint size={20} strokeWidth={2} />
          <span className="customerHeaderName">Central Vet</span>
        </div>
        <div className="customerHeaderUser">
          <span className="customerHeaderGreeting">
            {session.name}
          </span>
          <button className="iconButton customerLogoutBtn" onClick={handleLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="customerMain">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          placeholder="Ask about appointments, prescriptions, check-in…"
        />
      </main>
    </div>
  );
}

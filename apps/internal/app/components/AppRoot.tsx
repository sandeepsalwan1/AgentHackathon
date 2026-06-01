"use client";

import { useEffect, useState } from "react";
import { getSession, logout, type AccountSession } from "../lib/accountStore";
import { CreateVetPanel } from "./admin/CreateVetPanel";
import { AuthScreen } from "./auth/AuthScreen";
import { CustomerExperience } from "./customer/CustomerExperience";
import { TaskBoard } from "./TaskBoard";
import { VetDashboard } from "./vet/VetDashboard";

type View =
  | { kind: "loading" }
  | { kind: "auth" }
  | { kind: "legacy" } // staff/VA with existing passcode board
  | { kind: "customer"; session: AccountSession }
  | { kind: "veterinarian"; session: AccountSession }
  | { kind: "admin"; session: AccountSession };

export function AppRoot() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    const id = window.setTimeout(() => {
      const session = getSession();
      setView(session ? { kind: session.role, session } : { kind: "auth" });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function handleAuth(session: AccountSession) {
    setView({ kind: session.role, session });
  }

  function handleLegacyStaff() {
    setView({ kind: "legacy" });
  }

  function handleLogout() {
    logout();
    setView({ kind: "auth" });
  }

  function handleOpenLegacyBoard() {
    setView({ kind: "legacy" });
  }

  if (view.kind === "loading") {
    return (
      <main className="entryShell">
        <section className="entryPanel bootPanel">
          <p className="eyebrow">Central Veterinary Hospital</p>
          <h1>Opening…</h1>
          <div className="bootBar" aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (view.kind === "auth") {
    return <AuthScreen onAuth={handleAuth} onLegacyStaff={handleLegacyStaff} />;
  }

  if (view.kind === "legacy") {
    return <TaskBoard />;
  }

  if (view.kind === "customer") {
    return <CustomerExperience session={view.session} onLogout={handleLogout} />;
  }

  if (view.kind === "veterinarian") {
    return <VetDashboard session={view.session} onLogout={handleLogout} />;
  }

  if (view.kind === "admin") {
    return (
      <CreateVetPanel
        session={view.session}
        onLogout={handleLogout}
        onOpenLegacyBoard={handleOpenLegacyBoard}
      />
    );
  }

  // Fallback
  logout();
  return <AuthScreen onAuth={handleAuth} onLegacyStaff={handleLegacyStaff} />;
}

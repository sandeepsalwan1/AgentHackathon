"use client";

import { useEffect, useState } from "react";
import { getSession, logout, type AccountSession } from "../lib/accountStore";
import { AdminDashboard } from "./admin/AdminDashboard";
import { AuthScreen } from "./auth/AuthScreen";
import { ClinicProvider, useClinicBrand } from "./ClinicContext";
import { CustomerExperience } from "./customer/CustomerExperience";
import { TaskBoard } from "./TaskBoard";

// One app, clear surfaces:
// - pet owners get the chat portal
// - staff, VAs, and vets share the clinic task board (the simple, proven work queue)
// - admins get the tabbed dashboard: tasks, AI assistant, and team accounts
type View =
  | { kind: "loading" }
  | { kind: "auth" }
  | { kind: "board" } // staff / VA / veterinarian on the shared task board
  | { kind: "customer"; session: AccountSession }
  | { kind: "admin"; session: AccountSession };

function viewForSession(session: AccountSession): View {
  if (session.role === "customer") return { kind: "customer", session };
  if (session.role === "admin") return { kind: "admin", session };
  // staff, VA, and veterinarian all work from the shared task board
  return { kind: "board" };
}

function AppRootContent() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const clinic = useClinicBrand();

  useEffect(() => {
    const id = window.setTimeout(() => {
      const session = getSession();
      setView(session ? viewForSession(session) : { kind: "auth" });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function handleAuth(session: AccountSession) {
    setView(viewForSession(session));
  }

  function handleOpenBoard() {
    setView({ kind: "board" });
  }

  function handleLogout() {
    logout();
    setView({ kind: "auth" });
  }

  if (view.kind === "loading") {
    return (
      <main className="entryShell">
        <section className="entryPanel bootPanel">
          <p className="eyebrow">{clinic.name}</p>
          <h1>Opening…</h1>
          <div className="bootBar" aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (view.kind === "auth") {
    return <AuthScreen onAuth={handleAuth} onLegacyStaff={handleOpenBoard} />;
  }

  if (view.kind === "board") {
    return <TaskBoard />;
  }

  if (view.kind === "customer") {
    return <CustomerExperience session={view.session} onLogout={handleLogout} />;
  }

  if (view.kind === "admin") {
    return (
      <AdminDashboard
        session={view.session}
        onLogout={handleLogout}
        onOpenBoard={handleOpenBoard}
      />
    );
  }

  logout();
  return <AuthScreen onAuth={handleAuth} onLegacyStaff={handleOpenBoard} />;
}

export function AppRoot() {
  return (
    <ClinicProvider>
      <AppRootContent />
    </ClinicProvider>
  );
}

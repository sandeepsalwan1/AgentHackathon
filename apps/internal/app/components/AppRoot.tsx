"use client";

import { useEffect, useState } from "react";
import { getSession, logout, type AccountSession } from "../lib/accountStore";
import { CreateVetPanel } from "./admin/CreateVetPanel";
import { AuthScreen } from "./auth/AuthScreen";
import { CustomerExperience } from "./customer/CustomerExperience";
import { TaskBoard } from "./TaskBoard";

// One app, three surfaces:
// - pet owners get the chat portal
// - staff and vets share the clinic task board (the real work queue)
// - admins get the team panel, with a button into the same board
type View =
  | { kind: "loading" }
  | { kind: "auth" }
  | { kind: "board" } // staff / vet / VA on the shared task board
  | { kind: "customer"; session: AccountSession }
  | { kind: "admin"; session: AccountSession };

function viewForSession(session: AccountSession): View {
  if (session.role === "customer") return { kind: "customer", session };
  if (session.role === "admin") return { kind: "admin", session };
  // staff + veterinarian both work from the shared task board
  return { kind: "board" };
}

export function AppRoot() {
  const [view, setView] = useState<View>({ kind: "loading" });

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
          <p className="eyebrow">Central Veterinary Hospital</p>
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
      <CreateVetPanel
        session={view.session}
        onLogout={handleLogout}
        onOpenLegacyBoard={handleOpenBoard}
      />
    );
  }

  logout();
  return <AuthScreen onAuth={handleAuth} onLegacyStaff={handleOpenBoard} />;
}

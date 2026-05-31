"use client";

import {
  Clipboard,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { FormEvent, useState } from "react";
import {
  createVeterinarian,
  listVeterinarians,
  logout,
  type Account,
  type AccountSession,
} from "../../lib/accountStore";

type Props = {
  session: AccountSession;
  onLogout: () => void;
  onOpenLegacyBoard: () => void;
};

function CopyableOtp({ otp }: { otp: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="otpDisplay">
      <code className="otpCode">{otp}</code>
      <button type="button" className="otpCopyBtn" onClick={copy} title="Copy one-time password">
        {copied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export function CreateVetPanel({ session, onLogout, onOpenLegacyBoard }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdOtp, setCreatedOtp] = useState<{ name: string; otp: string } | null>(null);
  const [vets, setVets] = useState<Account[]>(() => listVeterinarians());

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setCreatedOtp(null);
    try {
      const { account, otp } = await createVeterinarian({ name, email });
      setCreatedOtp({ name: account.name, otp });
      setVets(listVeterinarians());
      setName("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  return (
    <div className="adminShell">
      <header className="adminHeader">
        <div className="adminHeaderLeft">
          <ShieldCheck size={22} strokeWidth={1.8} />
          <div>
            <p className="adminHeaderEyebrow">Central Veterinary Hospital</p>
            <h1 className="adminHeaderTitle">Admin Portal</h1>
          </div>
        </div>
        <div className="adminHeaderRight">
          <span className="adminHeaderUser">{session.name}</span>
          <button
            className="plainButton adminBoardBtn"
            onClick={onOpenLegacyBoard}
            title="Open clinic task board"
          >
            <LayoutDashboard size={16} />
            Task Board
          </button>
          <button className="iconButton" onClick={handleLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="adminMain">
        <div className="adminGrid">
          {/* Create veterinarian form */}
          <section className="adminCard">
            <div className="adminCardHeader">
              <UserPlus size={18} />
              <h2>Add Veterinarian</h2>
            </div>
            <p className="adminCardDesc">
              Create a veterinarian account and issue a one-time password for first login.
            </p>

            {createdOtp && (
              <div className="adminSuccessBox">
                <h3>Account created for {createdOtp.name}</h3>
                <p>Share this one-time password securely. It expires on first use.</p>
                <CopyableOtp otp={createdOtp.otp} />
                <p className="adminSuccessNote">
                  The veterinarian visits the <strong>Clinic Team</strong> tab on the login page
                  and clicks &ldquo;Redeem your one-time password&rdquo; to activate their account.
                </p>
              </div>
            )}

            <form className="adminForm" onSubmit={submit}>
              <label className="authLabel">
                Full name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  required
                  autoFocus
                />
              </label>
              <label className="authLabel">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dr.smith@centralvet.com"
                  required
                />
              </label>
              {error && <div className="authError">{error}</div>}
              <button className="authPrimaryBtn" type="submit" disabled={loading}>
                <UserPlus size={16} />
                {loading ? "Creating…" : "Create account & generate OTP"}
              </button>
            </form>
          </section>

          {/* Existing veterinarians list */}
          <section className="adminCard">
            <div className="adminCardHeader">
              <Users size={18} />
              <h2>Veterinarians</h2>
              <span className="adminVetCount">{vets.length}</span>
            </div>

            {vets.length === 0 ? (
              <p className="adminEmptyState">No veterinarian accounts yet. Create one above.</p>
            ) : (
              <div className="adminVetList">
                {vets.map((vet) => (
                  <div key={vet.id} className="adminVetRow">
                    <div className="adminVetInfo">
                      <span className="adminVetName">{vet.name}</span>
                      <span className="adminVetEmail">{vet.email}</span>
                    </div>
                    <div className="adminVetStatus">
                      {vet.mustResetPassword ? (
                        <span className="adminVetPending">Pending activation</span>
                      ) : (
                        <span className="adminVetActive">Active</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

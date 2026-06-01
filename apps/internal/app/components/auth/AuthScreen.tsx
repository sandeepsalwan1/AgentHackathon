"use client";

import { Eye, EyeOff, Heart, LogIn, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  getDemoAdminCredentials,
  login,
  redeemOtp,
  saveSession,
  signupCustomer,
  type AccountSession,
} from "../../lib/accountStore";

type Props = {
  onAuth: (session: AccountSession) => void;
  onLegacyStaff: () => void;
};

type Tab = "customer" | "staff";
type CustomerView = "login" | "signup";

function PasswordInput({
  value,
  onChange,
  placeholder,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  name?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="authPasswordWrap">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Password"}
        name={name}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="authPasswordToggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function CustomerLogin({ onAuth, onSwitch }: { onAuth: Props["onAuth"]; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const account = await login(email, password);
      onAuth(saveSession(account));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="authForm" onSubmit={submit}>
      <h2 className="authFormTitle">Welcome back</h2>
      <p className="authFormSubtitle">Sign in to manage your pet&apos;s care</p>
      <label className="authLabel">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          required
        />
      </label>
      <label className="authLabel">
        Password
        <PasswordInput value={password} onChange={setPassword} />
      </label>
      {error && <div className="authError">{error}</div>}
      <button className="authPrimaryBtn" type="submit" disabled={loading}>
        <LogIn size={16} />
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="authSwitch">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={onSwitch}>
          Create one
        </button>
      </p>
    </form>
  );
}

function CustomerSignup({ onAuth, onSwitch }: { onAuth: Props["onAuth"]; onSwitch: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!phone.trim() || phone.replace(/\D/g, "").length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (!petName.trim() || petName.trim().length < 2) {
      setError("Please enter your pet's name (at least 2 characters).");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const account = await signupCustomer({ name, email, phone, petName, password });
      onAuth(saveSession(account));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="authForm" onSubmit={submit}>
      <h2 className="authFormTitle">Create account</h2>
      <p className="authFormSubtitle">Your pet deserves great care</p>
      <label className="authLabel">
        Full name <span className="authRequired">*</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          autoFocus
          required
        />
      </label>
      <label className="authLabel">
        Email <span className="authRequired">*</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <label className="authLabel">
        Phone number <span className="authRequired">*</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 000-0000"
          inputMode="tel"
          required
        />
      </label>
      <label className="authLabel">
        Pet&apos;s name <span className="authRequired">*</span>
        <input
          type="text"
          value={petName}
          onChange={(e) => setPetName(e.target.value)}
          placeholder="Buddy, Luna, Max…"
          required
        />
      </label>
      <label className="authLabel">
        Password <span className="authRequired">*</span>
        <PasswordInput value={password} onChange={setPassword} name="new-password" />
      </label>
      {error && <div className="authError">{error}</div>}
      <button className="authPrimaryBtn" type="submit" disabled={loading}>
        <UserPlus size={16} />
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="authSwitch">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch}>
          Sign in
        </button>
      </p>
    </form>
  );
}

function StaffPortal({ onAuth, onLegacyStaff }: { onAuth: Props["onAuth"]; onLegacyStaff: () => void }) {
  const [view, setView] = useState<"login" | "redeem">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const demo = getDemoAdminCredentials();

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const account = await login(email, password);
      if (account.role !== "veterinarian" && account.role !== "admin") {
        throw new Error("This portal is for veterinarians and admins only.");
      }
      onAuth(saveSession(account));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      if (msg.includes("one-time password")) {
        setError("");
        setView("redeem");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitRedeem(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const account = await redeemOtp(email, otp, newPassword);
      onAuth(saveSession(account));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to redeem one-time password.");
    } finally {
      setLoading(false);
    }
  }

  if (view === "redeem") {
    return (
      <form className="authForm" onSubmit={submitRedeem}>
        <h2 className="authFormTitle">Set your password</h2>
        <p className="authFormSubtitle">Use the one-time password provided by your administrator</p>
        <label className="authLabel">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="authLabel">
          One-time password
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.toUpperCase())}
            placeholder="e.g. A1B2C3D4"
            style={{ fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
            required
          />
        </label>
        <label className="authLabel">
          New password
          <PasswordInput value={newPassword} onChange={setNewPassword} name="new-password" />
        </label>
        {error && <div className="authError">{error}</div>}
        <button className="authPrimaryBtn" type="submit" disabled={loading}>
          {loading ? "Activating…" : "Activate account"}
        </button>
        <p className="authSwitch">
          <button type="button" onClick={() => { setView("login"); setError(""); }}>
            Back to sign in
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="authForm" onSubmit={submitLogin}>
      <h2 className="authFormTitle">Clinic portal</h2>
      <p className="authFormSubtitle">Veterinarians &amp; administrators</p>
      <div className="authDemoHint">
        <span className="authDemoLabel">Demo admin:</span>
        <code>{demo.email}</code> / <code>{demo.password}</code>
      </div>
      <label className="authLabel">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="doctor@centralvet.com"
          autoFocus
          required
        />
      </label>
      <label className="authLabel">
        Password
        <PasswordInput value={password} onChange={setPassword} />
      </label>
      {error && <div className="authError">{error}</div>}
      <button className="authPrimaryBtn" type="submit" disabled={loading}>
        <LogIn size={16} />
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="authSwitch">
        First time?{" "}
        <button type="button" onClick={() => { setView("redeem"); setError(""); }}>
          Redeem your one-time password
        </button>
      </p>
      <div className="authDivider" />
      <button type="button" className="authGhostBtn" onClick={onLegacyStaff}>
        Staff / VA sign-in (clinic board)
      </button>
    </form>
  );
}

export function AuthScreen({ onAuth, onLegacyStaff }: Props) {
  const [tab, setTab] = useState<Tab>("customer");
  const [customerView, setCustomerView] = useState<CustomerView>("login");

  return (
    <div className="authShell">
      {/* Left brand panel */}
      <div className="authBrandPanel">
        <div className="authBrandContent">
          <div className="authBrandLogo">
            <Heart size={32} strokeWidth={2.5} />
          </div>
          <p className="authBrandEyebrow">Central Veterinary Hospital</p>
          <h1 className="authBrandTitle">
            Care that<br />goes further
          </h1>
          <p className="authBrandTagline">
            Appointments, check-ins, records, and real-time updates — all in one place for you and your pet.
          </p>
          <div className="authBrandFeatures">
            <div className="authBrandFeature">
              <span className="authBrandFeatureDot" />
              Instant appointment booking
            </div>
            <div className="authBrandFeature">
              <span className="authBrandFeatureDot" />
              AI-assisted care navigation
            </div>
            <div className="authBrandFeature">
              <span className="authBrandFeatureDot" />
              Secure records management
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="authFormPanel">
        <div className="authCard">
          <div className="authTabs">
            <button
              className={`authTab${tab === "customer" ? " authTab--active" : ""}`}
              type="button"
              onClick={() => setTab("customer")}
            >
              Pet Owner
            </button>
            <button
              className={`authTab${tab === "staff" ? " authTab--active" : ""}`}
              type="button"
              onClick={() => setTab("staff")}
            >
              Clinic Team
            </button>
          </div>

          {tab === "customer" ? (
            customerView === "login" ? (
              <CustomerLogin onAuth={onAuth} onSwitch={() => setCustomerView("signup")} />
            ) : (
              <CustomerSignup onAuth={onAuth} onSwitch={() => setCustomerView("login")} />
            )
          ) : (
            <StaffPortal onAuth={onAuth} onLegacyStaff={onLegacyStaff} />
          )}
        </div>
      </div>
    </div>
  );
}

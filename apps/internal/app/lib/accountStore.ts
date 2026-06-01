// MOCK ACCOUNT STORE — localStorage backend
// All functions are async to mirror the future REST interface.
// Replace implementations with real API calls when the backend is ready.
// SECURITY NOTE: mockHash is NOT cryptographic. Replace with bcrypt server-side.

export type AuthRole = "customer" | "veterinarian" | "staff" | "admin";

// Roles an admin can create from the clinic team panel.
export type TeamRole = "veterinarian" | "staff";

export type Account = {
  id: string;
  role: AuthRole;
  name: string;
  email: string;
  phone?: string;
  petName?: string;
  passwordHash: string;
  mustResetPassword?: boolean;
  otp?: string;
  createdAt: string;
};

export type AccountSession = {
  accountId: string;
  role: AuthRole;
  name: string;
  email: string;
  phone?: string;
  petName?: string;
  source: "account"; // discriminator — legacy passcode sessions lack this field
};

const ACCOUNTS_KEY = "central-vet-accounts";
const SESSION_KEY = "central-vet-session";

const DEMO_ADMIN = { email: "admin@centralvet.demo", password: "admin1234" };

// MOCK: base64 + salt. Replace with real hashing server-side.
function mockHash(value: string): string {
  return btoa(encodeURIComponent(`${value}::cvh-mock-salt`));
}

function mockVerify(value: string, hash: string): boolean {
  return mockHash(value) === hash;
}

function loadAccounts(): Account[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as Account[];
  } catch {
    return [];
  }
}

function persistAccounts(accounts: Account[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function generateOtp(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function seedAdmin(): void {
  const accounts = loadAccounts();
  if (accounts.some((a) => a.role === "admin")) return;
  persistAccounts([
    ...accounts,
    {
      id: uid(),
      role: "admin",
      name: "Clinic Admin",
      email: DEMO_ADMIN.email,
      passwordHash: mockHash(DEMO_ADMIN.password),
      createdAt: new Date().toISOString(),
    },
  ]);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getDemoAdminCredentials() {
  return DEMO_ADMIN;
}

export async function signupCustomer(params: {
  name: string;
  email: string;
  phone: string;
  petName: string;
  password: string;
}): Promise<Account> {
  seedAdmin();
  const accounts = loadAccounts();
  if (accounts.some((a) => a.email === params.email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const account: Account = {
    id: uid(),
    role: "customer",
    name: params.name.trim(),
    email: params.email.toLowerCase().trim(),
    phone: params.phone.trim(),
    petName: params.petName.trim(),
    passwordHash: mockHash(params.password),
    createdAt: new Date().toISOString(),
  };
  persistAccounts([...accounts, account]);
  return account;
}

export async function login(email: string, password: string): Promise<Account> {
  seedAdmin();
  const accounts = loadAccounts();
  const account = accounts.find((a) => a.email === email.toLowerCase().trim());
  if (!account) throw new Error("No account found with this email.");
  if (account.mustResetPassword) {
    throw new Error("Please redeem your one-time password to set a new password.");
  }
  if (!mockVerify(password, account.passwordHash)) throw new Error("Incorrect password.");
  return account;
}

// Admin creates a clinic team member (veterinarian or staff). New members get a
// one-time password and must set their own password on first sign-in.
export async function createTeamMember(params: {
  name: string;
  email: string;
  role: TeamRole;
}): Promise<{ account: Account; otp: string }> {
  const accounts = loadAccounts();
  if (accounts.some((a) => a.email === params.email.toLowerCase().trim())) {
    throw new Error("An account with this email already exists.");
  }
  const otp = generateOtp();
  const account: Account = {
    id: uid(),
    role: params.role,
    name: params.name.trim(),
    email: params.email.toLowerCase().trim(),
    passwordHash: "",
    mustResetPassword: true,
    otp,
    createdAt: new Date().toISOString(),
  };
  persistAccounts([...accounts, account]);
  return { account, otp };
}

export async function redeemOtp(
  email: string,
  otp: string,
  newPassword: string
): Promise<Account> {
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.email === email.toLowerCase().trim());
  if (idx === -1) throw new Error("No account found with this email.");
  const account = accounts[idx];
  if (!account.mustResetPassword || account.otp !== otp.trim().toUpperCase()) {
    throw new Error("Invalid or expired one-time password.");
  }
  if (newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
  const updated: Account = {
    ...account,
    passwordHash: mockHash(newPassword),
    mustResetPassword: false,
    otp: undefined,
  };
  const next = [...accounts];
  next[idx] = updated;
  persistAccounts(next);
  return updated;
}

export function getSession(): AccountSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (parsed?.source === "account") return parsed as AccountSession;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(account: Account): AccountSession {
  const session: AccountSession = {
    accountId: account.id,
    role: account.role,
    name: account.name,
    email: account.email,
    phone: account.phone,
    petName: account.petName,
    source: "account",
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function listTeam(): Account[] {
  return loadAccounts()
    .filter((a) => a.role === "veterinarian" || a.role === "staff")
    .sort((a, b) => a.name.localeCompare(b.name));
}

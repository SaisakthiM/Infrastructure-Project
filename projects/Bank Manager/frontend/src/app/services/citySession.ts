/**
 * The bank UI and every district share ONE session: localStorage "city.session" (the same record city-core.js writes).
 * Signing in here therefore signs you into grocery / housing / hospital / media / api-service, and signing in at the
 * city gate signs you in here.
 */
const SESSION_KEY = "city.session";
const ACCOUNT_KEY = "city.account";

export interface CitySession {
  token: string;
  username: string;
  accountId: string;
  accountNumber: string;
  savedAt: number;
  offline?: boolean;
}

function decodeExp(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function loadSession(): CitySession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.token || s.offline) return null; // an offline (safe-mode) session has no live token
    const exp = decodeExp(s.token);
    if (exp && exp < Date.now()) {
      clearSession();
      return null;
    }
    return { ...s, accountId: String(s.accountId) } as CitySession;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return loadSession()?.token ?? null;
}

export function saveAuth(data: {
  token: string;
  username: string;
  accountId: string | number;
  accountNumber: string;
  balance?: number;
  loanBalance?: number;
  creditScore?: number;
}): void {
  const session: CitySession = {
    token: data.token,
    username: data.username,
    accountId: String(data.accountId),
    accountNumber: data.accountNumber,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    saveAccount({ ...data, customerName: data.username });
  } catch {
    /* private mode — the UI still works for this tab */
  }
}

export function saveAccount(a: {
  balance?: number;
  loanBalance?: number;
  creditScore?: number;
  customerName?: string;
  accountNumber?: string;
}): void {
  try {
    const prev = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "{}");
    localStorage.setItem(
      ACCOUNT_KEY,
      JSON.stringify({
        balance: Number(a.balance ?? prev.balance ?? 0),
        loanBalance: Number(a.loanBalance ?? prev.loanBalance ?? 0),
        creditScore: Number(a.creditScore ?? prev.creditScore ?? 0),
        customerName: a.customerName ?? prev.customerName ?? "",
        accountNumber: a.accountNumber ?? prev.accountNumber ?? "",
      }),
    );
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* ignore */
  }
}

/** fires when another tab / district signs in or out */
export function onSessionChange(cb: () => void): () => void {
  const h = (e: StorageEvent) => {
    if (e.key === SESSION_KEY || e.key === null) cb();
  };
  window.addEventListener("storage", h);
  return () => window.removeEventListener("storage", h);
}

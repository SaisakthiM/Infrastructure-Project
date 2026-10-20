import axios from 'axios';
import { clearSession, getToken, saveAccount, saveAuth } from './citySession';

// Where the bank API lives, tried in order. The first that answers is remembered.
//   /bank/api                   -> through the gateway / the local nginx (same origin, no CORS)
//   localhost:8080 / 127.0.0.1  -> the bank container's published port, only when this page is on localhost
//                                  (needs the page's origin in the bank's CORS list: BANK_CORS_ORIGINS)
const BASE_KEY = 'city.bank.base';
function candidateBases(): string[] {
  const out: string[] = [];
  const add = (b?: string | null) => {
    const v = (b || '').trim().replace(/\/+$/, '');
    if (v && !out.includes(v)) out.push(v);
  };
  const w = window as any;
  add(w.CITY_BANK_BASE);
  (Array.isArray(w.CITY_BANK_BASES) ? w.CITY_BANK_BASES : []).forEach(add);
  add('/bank/api');
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    add('http://localhost:8080/api');
    add('http://127.0.0.1:8080/api');
  }
  try {
    const remembered = localStorage.getItem(BASE_KEY);
    if (remembered && out.includes(remembered)) {
      out.splice(out.indexOf(remembered), 1);
      out.unshift(remembered);
    }
  } catch {
    /* no storage */
  }
  return out;
}

const looksDown = (e: any) =>
  !e.response || (typeof e.response.data === 'string' && /<html|<!doctype/i.test(e.response.data)) || [502, 503, 504].includes(e.response?.status);

/**
 * One request with fail-over. Money-moving calls (deposit / withdraw / loan / repay) never fail over:
 * a retry on another URL after a timeout could charge twice. Reads, login and register do.
 */
async function call<T = any>(method: 'get' | 'post', path: string, data?: unknown, opts: { auth?: boolean; failover?: boolean } = {}): Promise<T> {
  const { auth = true, failover = true } = opts;
  const bases = failover ? candidateBases() : candidateBases().slice(0, 1);
  const headers: Record<string, string> = {};
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let last: any;
  for (const base of bases) {
    try {
      const res = await axios.request({ method, url: base + path, data, headers, timeout: 12000 });
      if (typeof res.data === 'string' && /<html|<!doctype/i.test(res.data)) throw Object.assign(new Error('bank returned a web page'), { response: res });
      try { localStorage.setItem(BASE_KEY, base); } catch { /* no storage */ }
      return res.data as T;
    } catch (e: any) {
      last = e;
      if (e.response?.status === 401 && auth) {
        clearSession(); // token expired / not valid any more -> back to the login screen
        window.dispatchEvent(new Event('city:session-expired'));
      }
      if (!looksDown(e)) break;
    }
  }
  if (last && looksDown(last)) throw { success: false, message: 'The bank is unreachable right now. Try again in a moment.' };
  throw last?.response?.data || { message: last?.message || 'Request failed' };
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    token: string;
    username: string;
    accountNumber: string;
    accountId: string;
    balance: number;
    creditScore: number;
    loanBalance: number;
  };
}

export interface AccountResponse {
  success?: boolean;
  data: {
    customerName: string;
    accountNumber: string;
    balance: number;
    loanBalance: number;
    creditScore: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface TransactionResponse {
  success?: boolean;
  data: {
    balance: number;
    creditScore: number;
    loanBalance: number;
  };
}

const bankService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const res = await call<AuthResponse>('post', '/auth/login', { username, password }, { auth: false });
    if (res?.success && res.data?.token) saveAuth(res.data); // shared city session: every district is now signed in
    return res;
  },

  register: async (username: string, password: string): Promise<AuthResponse> => {
    const res = await call<AuthResponse>('post', '/auth/register', { username, password }, { auth: false });
    if (res?.success && res.data?.token) saveAuth(res.data);
    return res;
  },

  getAccountById: async (accountId: string): Promise<AccountResponse> => {
    const res = await call<AccountResponse>('get', `/accounts/${accountId}`);
    if (res?.data) saveAccount(res.data);
    return res;
  },

  deposit: async (accountId: string, amount: number, description: string): Promise<TransactionResponse> => {
    const res = await call<TransactionResponse>('post', `/accounts/${accountId}/deposit`, { amount, description }, { failover: false });
    if (res?.data) saveAccount(res.data);
    return res;
  },

  withdraw: async (accountId: string, amount: number, description: string): Promise<TransactionResponse> => {
    const res = await call<TransactionResponse>('post', `/accounts/${accountId}/withdraw`, { amount, description }, { failover: false });
    if (res?.data) saveAccount(res.data);
    return res;
  },

  takeLoan: async (accountId: string, amount: number, months: number, description: string): Promise<TransactionResponse> => {
    const res = await call<TransactionResponse>('post', `/accounts/${accountId}/loan`, { amount, months, description }, { failover: false });
    if (res?.data) saveAccount(res.data);
    return res;
  },

  repayLoan: async (accountId: string, amount: number, description: string): Promise<TransactionResponse> => {
    const res = await call<TransactionResponse>('post', `/accounts/${accountId}/repay`, { amount, description }, { failover: false });
    if (res?.data) saveAccount(res.data);
    return res;
  },

  logout: () => clearSession(),
};

export default bankService;

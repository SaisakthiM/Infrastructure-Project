import { useState, useEffect } from "react";
import { ActionModal } from "./ActionModal";
import bankService from "../services/bankService";

export interface BankUser {
  username: string;
  accountNumber: string;
  accountId: string;
  balance: number;
  creditScore: number;
  loanBalance: number;
}

interface DashboardProps {
  user: BankUser;
  onLogout: () => void;
  onUpdateUser: (updated: BankUser) => void;
}

type ModalType = "deposit" | "withdraw" | "loan" | "repay" | "details" | null;

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "loan" | "repayment";
  amount: number;
  date: string;
  description: string;
}

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");

function getCreditLabel(score: number): { label: string; color: string } {
  if (score >= 750) return { label: "Excellent", color: "var(--ok)" };
  // four bands, three registry colours: "Good" is moss pulled toward ochre rather than a fourth hue
  if (score >= 700) return { label: "Good", color: "color-mix(in srgb, var(--ok) 72%, var(--warn))" };
  if (score >= 650) return { label: "Fair", color: "var(--warn)" };
  return { label: "Poor", color: "var(--bad)" };
}

const TX_SIGN: Record<Transaction["type"], string> = { deposit: "+", loan: "+", withdrawal: "−", repayment: "−" };

export function Dashboard({ user, onLogout, onUpdateUser }: DashboardProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [accountDetails, setAccountDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const creditInfo = getCreditLabel(user.creditScore);

  const addTransaction = (tx: Omit<Transaction, "id" | "date">) => {
    setTransactions((prev) => [{ ...tx, id: Math.random().toString(36).slice(2), date: new Date().toLocaleString("en-IN") }, ...prev]);
  };

  const fetchAccountDetails = async () => {
    setDetailsLoading(true);
    setDetailsError("");
    try {
      const res = await bankService.getAccountById(user.accountId);
      if (res.data) setAccountDetails(res.data);
    } catch (err: any) {
      setDetailsError(err?.message || "Failed to fetch account details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (activeModal === "details") fetchAccountDetails();
  }, [activeModal]);

  const handleAction = async (type: "deposit" | "withdraw" | "loan" | "repay", amount: number, description: string, months?: number) => {
    setActionLoading(true);
    setActionError("");
    try {
      let res;
      if (type === "deposit") res = await bankService.deposit(user.accountId, amount, description);
      else if (type === "withdraw") res = await bankService.withdraw(user.accountId, amount, description);
      else if (type === "loan") res = await bankService.takeLoan(user.accountId, amount, months!, description);
      else res = await bankService.repayLoan(user.accountId, amount, description);

      const map = { deposit: "deposit", withdraw: "withdrawal", loan: "loan", repay: "repayment" } as const;
      addTransaction({ type: map[type], amount, description });
      onUpdateUser({ ...user, balance: res.data.balance, creditScore: res.data.creditScore, loanBalance: res.data.loanBalance });
      setActiveModal(null);
    } catch (err: any) {
      setActionError(err?.message || "Transaction failed. Please try again.");
      setActiveModal(null);
    } finally {
      setActionLoading(false);
    }
  };

  const actions: { id: ModalType; label: string; hint: string }[] = [
    { id: "deposit", label: "Deposit", hint: "Add funds" },
    { id: "withdraw", label: "Withdraw", hint: "Take funds out" },
    { id: "loan", label: "Take a loan", hint: "Up to 60 months" },
    { id: "repay", label: "Repay loan", hint: "Pay it down" },
    { id: "details", label: "Account info", hint: "Live details" },
  ];

  const details = [
    ["Account holder", accountDetails?.customerName || user.username],
    ["Account number", accountDetails?.accountNumber || user.accountNumber],
    ["Balance", formatINR(accountDetails?.balance ?? user.balance)],
    ["Loan balance", formatINR(accountDetails?.loanBalance ?? user.loanBalance)],
    ["Credit score", `${accountDetails?.creditScore ?? user.creditScore} · ${getCreditLabel(accountDetails?.creditScore ?? user.creditScore).label}`],
  ];

  return (
    <main className="bk-page">
      <section className="bk-hero">
        <div className="glass accent">
          <div className="bd">
            <div className="eyebrow">Available balance · {user.username}</div>
            <div className="bk-balance">{formatINR(user.balance)}</div>
            <div className="muted" style={{ fontSize: 12 }}>Account {user.accountNumber}</div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={onLogout}>Sign out of the city</button>
            </div>
          </div>
        </div>
        <div className="glass">
          <div className="bd">
            <div className="eyebrow">Credit &amp; loan</div>
            <div className="display" style={{ fontSize: 34, color: creditInfo.color }}>{user.creditScore}</div>
            <div className="muted" style={{ marginBottom: 10 }}>{creditInfo.label}</div>
            <div className="bk-kv"><div><span className="muted">Loan balance</span><b>{formatINR(user.loanBalance)}</b></div></div>
          </div>
        </div>
      </section>

      {actionError && <div className="glass"><div className="bd bad">{actionError}</div></div>}

      <section className="bk-acts">
        {actions.map((a) => (
          <button key={a.id} className="bk-act" onClick={() => { setActionError(""); setActiveModal(a.id); }}>
            <b>{a.label}</b>
            <span className="muted">{a.hint}</span>
          </button>
        ))}
      </section>

      <section className="glass">
        <div className="hd"><span>This session</span><small>{transactions.length} transactions</small></div>
        {transactions.length === 0 ? (
          <div className="empty">No transactions yet.</div>
        ) : (
          <div className="bk-kv" style={{ padding: "4px 16px" }}>
            {transactions.map((t) => (
              <div key={t.id}>
                <span>
                  <b style={{ textTransform: "capitalize" }}>{t.type}</b>
                  <br /><small className="muted">{t.description} · {t.date}</small>
                </span>
                <b className={TX_SIGN[t.type] === "+" ? "ok" : "bad"}>{TX_SIGN[t.type]}{formatINR(t.amount)}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      {activeModal && activeModal !== "details" && (
        <ActionModal
          type={activeModal}
          user={user}
          loading={actionLoading}
          onConfirm={(amount, desc, months) => handleAction(activeModal, amount, desc, months)}
          onClose={() => { setActiveModal(null); setActionError(""); }}
        />
      )}

      {activeModal === "details" && (
        <div className="bk-modal" onMouseDown={(e) => e.target === e.currentTarget && setActiveModal(null)}>
          <div className="glass accent">
            <div className="hd"><span>Account details</span><button className="btn sm ghost" onClick={() => setActiveModal(null)}>✕</button></div>
            <div className="bd">
              {detailsLoading && <p className="muted">Loading…</p>}
              {detailsError && <p className="bad">{detailsError}</p>}
              <div className="bk-kv">
                {details.map(([k, v]) => <div key={k}><span className="muted">{k}</span><b>{v}</b></div>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

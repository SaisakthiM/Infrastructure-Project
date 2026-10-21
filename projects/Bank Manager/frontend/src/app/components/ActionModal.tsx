import { useState } from "react";
import type { BankUser } from "./Dashboard";

interface ActionModalProps {
  type: "deposit" | "withdraw" | "loan" | "repay";
  user: BankUser;
  onConfirm: (amount: number, description: string, months?: number) => void;
  onClose: () => void;
  loading?: boolean;
}

const configs = {
  deposit: { title: "Add a deposit", subtitle: "Transfer funds into your account", button: "Deposit funds", descDefault: "Cash deposit" },
  withdraw: { title: "Withdraw funds", subtitle: "Transfer funds out of your account", button: "Withdraw funds", descDefault: "Cash withdrawal" },
  loan: { title: "Take a loan", subtitle: "Borrow funds against your credit score", button: "Apply for loan", descDefault: "Personal loan" },
  repay: { title: "Repay loan", subtitle: "Make a payment toward your loan balance", button: "Make payment", descDefault: "Loan repayment" },
};

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");

export function ActionModal({ type, user, onConfirm, onClose, loading }: ActionModalProps) {
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const config = configs[type];

  const validate = (): string => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) return "Please enter a valid amount.";
    if (type === "withdraw" && num > user.balance) return `Insufficient balance. Available: ${formatINR(user.balance)}`;
    if (type === "repay" && num > user.loanBalance) return `Amount exceeds loan balance of ${formatINR(user.loanBalance)}.`;
    if (type === "repay" && num > user.balance) return `Insufficient balance. Available: ${formatINR(user.balance)}`;
    if (type === "loan") {
      if (num < 1000) return "Minimum loan amount is ₹1,000.";
      const m = parseInt(months);
      if (!months || isNaN(m) || m < 1) return "Please enter a valid repayment period.";
      if (m > 60) return "Maximum repayment period is 60 months.";
    }
    return "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    onConfirm(parseFloat(amount), description.trim() || config.descDefault, type === "loan" ? parseInt(months) : undefined);
  };

  const ctx =
    type === "withdraw" ? ["Available balance", formatINR(user.balance)] :
    type === "repay" ? ["Outstanding loan", formatINR(user.loanBalance)] :
    type === "loan" ? ["Credit score", String(user.creditScore)] :
    ["Current balance", formatINR(user.balance)];

  return (
    <div className="bk-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="glass accent" onSubmit={submit}>
        <div className="hd"><span>{config.title}</span><button type="button" className="btn sm ghost" onClick={onClose}>✕</button></div>
        <div className="bd">
          <p className="muted" style={{ margin: "0 0 4px" }}>{config.subtitle}</p>
          <p style={{ margin: "0 0 14px" }}><span className="eyebrow">{ctx[0]}</span><br /><b className="display" style={{ fontSize: 22 }}>{ctx[1]}</b></p>
          <label className="field">Amount (₹)
            <input type="number" inputMode="decimal" min="0" value={amount} autoFocus onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0" />
          </label>
          <div className="bk-chips">
            {[500, 1000, 5000, 10000].map((q) => <button type="button" key={q} className="btn sm" onClick={() => { setAmount(String(q)); setError(""); }}>{formatINR(q)}</button>)}
          </div>
          {type === "loan" && (
            <>
              <label className="field">Repayment period (months)
                <input type="number" min="1" max="60" value={months} onChange={(e) => { setMonths(e.target.value); setError(""); }} placeholder="12" />
              </label>
              <div className="bk-chips">
                {[6, 12, 24, 36].map((m) => <button type="button" key={m} className="btn sm" onClick={() => { setMonths(String(m)); setError(""); }}>{m} mo</button>)}
              </div>
            </>
          )}
          <label className="field">Note (optional)
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={config.descDefault} />
          </label>
          <div className="bk-msg bad">{error}</div>
          <div className="btn-row">
            <button className="btn primary" disabled={loading}>{loading ? "Processing…" : config.button}</button>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  );
}

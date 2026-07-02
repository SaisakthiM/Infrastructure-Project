import { useState } from "react";
import {
  X,
  PlusCircle,
  MinusCircle,
  Landmark,
  RefreshCcw,
  AlertTriangle,
  IndianRupee,
  Calendar,
} from "lucide-react";
import type { BankUser } from "./Dashboard";

interface ActionModalProps {
  type: "deposit" | "withdraw" | "loan" | "repay";
  user: BankUser;
  onConfirm: (amount: number, description: string, months?: number) => void;
  onClose: () => void;
  loading?: boolean;
}

const configs = {
  deposit: {
    title: "Add a Deposit",
    subtitle: "Transfer funds into your account",
    icon: PlusCircle,
    color: "#22c55e",
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    buttonLabel: "Deposit Funds",
    descDefault: "Cash deposit",
  },
  withdraw: {
    title: "Withdraw Funds",
    subtitle: "Transfer funds out of your account",
    icon: MinusCircle,
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    buttonLabel: "Withdraw Funds",
    descDefault: "Cash withdrawal",
  },
  loan: {
    title: "Take a Loan",
    subtitle: "Borrow funds against your credit score",
    icon: Landmark,
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    buttonLabel: "Apply for Loan",
    descDefault: "Personal loan",
  },
  repay: {
    title: "Repay Loan",
    subtitle: "Make a payment toward your loan balance",
    icon: RefreshCcw,
    color: "#a855f7",
    gradient: "linear-gradient(135deg, #a855f7, #9333ea)",
    buttonLabel: "Make Payment",
    descDefault: "Loan repayment",
  },
};

function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function ActionModal({ type, user, onConfirm, onClose, loading }: ActionModalProps) {
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const config = configs[type];
  const Icon = config.icon;

  const validate = (): string => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) return "Please enter a valid amount.";
    if (type === "withdraw" && num > user.balance)
      return `Insufficient balance. Available: ${formatINR(user.balance)}`;
    if (type === "repay" && num > user.loanBalance)
      return `Amount exceeds loan balance of ${formatINR(user.loanBalance)}.`;
    if (type === "repay" && num > user.balance)
      return `Insufficient balance. Available: ${formatINR(user.balance)}`;
    if (type === "loan") {
      if (num < 1000) return "Minimum loan amount is ₹1,000.";
      const mNum = parseInt(months);
      if (!months || isNaN(mNum) || mNum < 1) return "Please enter a valid repayment period.";
      if (mNum > 60) return "Maximum repayment period is 60 months.";
    }
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    onConfirm(
      parseFloat(amount),
      description.trim() || config.descDefault,
      type === "loan" ? parseInt(months) : undefined
    );
  };

  const quickAmounts = [500, 1000, 5000, 10000];
  const quickMonths = [6, 12, 24, 36];

  const getContextInfo = () => {
    if (type === "withdraw") return { label: "Available Balance", value: formatINR(user.balance) };
    if (type === "repay") return { label: "Outstanding Loan", value: formatINR(user.loanBalance) };
    if (type === "loan") return { label: "Credit Score", value: String(user.creditScore) };
    return { label: "Current Balance", value: formatINR(user.balance) };
  };

  const ctx = getContextInfo();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,15,28,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="relative px-6 py-5 flex items-center gap-3"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: `${config.color}12`,
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: config.gradient }}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white" style={{ fontWeight: 700, fontSize: "1rem" }}>
              {config.title}
            </h2>
            <p className="text-slate-400" style={{ fontSize: "0.78rem" }}>
              {config.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-7 h-7 flex items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Context info */}
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4" style={{ color: config.color }} />
              <span className="text-slate-400" style={{ fontSize: "0.78rem" }}>
                {ctx.label}
              </span>
            </div>
            <span className="text-white" style={{ fontWeight: 600, fontSize: "0.82rem" }}>
              {ctx.value}
            </span>
          </div>

          {/* Amount */}
          <div>
            <label
              className="block mb-1.5 text-slate-400"
              style={{ fontSize: "0.78rem", fontWeight: 500 }}
            >
              Amount (₹)
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                style={{ fontSize: "1rem", fontWeight: 500 }}
              >
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 rounded-xl outline-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: `1px solid ${error && !amount ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
                  color: "#fff",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                }}
              />
            </div>
            {/* Quick amounts */}
            <div className="flex gap-2 mt-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setAmount(q.toString());
                    setError("");
                  }}
                  className="flex-1 py-1.5 rounded-lg text-center transition-all"
                  style={{
                    background:
                      amount === q.toString()
                        ? `${config.color}25`
                        : "rgba(255,255,255,0.06)",
                    border: `1px solid ${
                      amount === q.toString()
                        ? config.color + "50"
                        : "rgba(255,255,255,0.08)"
                    }`,
                    color:
                      amount === q.toString() ? config.color : "rgba(255,255,255,0.55)",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  ₹{q >= 1000 ? `${q / 1000}k` : q}
                </button>
              ))}
            </div>
          </div>

          {/* Months — only for loan */}
          {type === "loan" && (
            <div>
              <label
                className="block mb-1.5 text-slate-400"
                style={{ fontSize: "0.78rem", fontWeight: 500 }}
              >
                Repayment Period (months)
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                />
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={months}
                  onChange={(e) => {
                    setMonths(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g. 12"
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                  }}
                />
              </div>
              {/* Quick month presets */}
              <div className="flex gap-2 mt-2">
                {quickMonths.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMonths(m.toString());
                      setError("");
                    }}
                    className="flex-1 py-1.5 rounded-lg text-center transition-all"
                    style={{
                      background:
                        months === m.toString()
                          ? "rgba(59,130,246,0.25)"
                          : "rgba(255,255,255,0.06)",
                      border: `1px solid ${
                        months === m.toString()
                          ? "rgba(59,130,246,0.5)"
                          : "rgba(255,255,255,0.08)"
                      }`,
                      color:
                        months === m.toString()
                          ? "#3b82f6"
                          : "rgba(255,255,255,0.55)",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {m}mo
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label
              className="block mb-1.5 text-slate-400"
              style={{ fontSize: "0.78rem", fontWeight: 500 }}
            >
              Description{" "}
              <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={config.descDefault}
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-xl outline-none"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                fontSize: "0.85rem",
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <AlertTriangle
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                style={{ color: "#fca5a5" }}
              />
              <span style={{ color: "#fca5a5", fontSize: "0.8rem" }}>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.65)",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl"
              style={{
                background: loading ? "rgba(100,100,100,0.4)" : config.gradient,
                border: "none",
                color: "#fff",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : `0 4px 16px ${config.color}35`,
              }}
            >
              {loading ? "Processing..." : config.buttonLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

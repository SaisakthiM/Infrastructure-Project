import { useState, useEffect } from "react";
import {
  Building2,
  LogOut,
  PlusCircle,
  MinusCircle,
  CreditCard,
  Landmark,
  RefreshCcw,
  User,
  TrendingUp,
  IndianRupee,
  Shield,
  ChevronRight,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from "lucide-react";
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

function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

function getCreditLabel(score: number): { label: string; color: string } {
  if (score >= 750) return { label: "Excellent", color: "#22c55e" };
  if (score >= 700) return { label: "Good", color: "#84cc16" };
  if (score >= 650) return { label: "Fair", color: "#eab308" };
  return { label: "Poor", color: "#ef4444" };
}

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
    setTransactions((prev) => [
      {
        ...tx,
        id: Math.random().toString(36).slice(2),
        date: new Date().toLocaleString("en-IN"),
      },
      ...prev,
    ]);
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
    if (activeModal === "details") {
      fetchAccountDetails();
    }
  }, [activeModal]);

  const handleAction = async (
    type: "deposit" | "withdraw" | "loan" | "repay",
    amount: number,
    description: string,
    months?: number
  ) => {
    setActionLoading(true);
    setActionError("");
    try {
      let res;
      if (type === "deposit") {
        res = await bankService.deposit(user.accountId, amount, description);
      } else if (type === "withdraw") {
        res = await bankService.withdraw(user.accountId, amount, description);
      } else if (type === "loan") {
        res = await bankService.takeLoan(user.accountId, amount, months!, description);
      } else {
        res = await bankService.repayLoan(user.accountId, amount, description);
      }

      const txTypeMap = {
        deposit: "deposit" as const,
        withdraw: "withdrawal" as const,
        loan: "loan" as const,
        repay: "repayment" as const,
      };
      addTransaction({ type: txTypeMap[type], amount, description });

      onUpdateUser({
        ...user,
        balance: res.data.balance,
        creditScore: res.data.creditScore,
        loanBalance: res.data.loanBalance,
      });
      setActiveModal(null);
    } catch (err: any) {
      setActionError(err?.message || "Transaction failed. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const actions = [
    {
      id: "deposit" as ModalType,
      label: "Deposit",
      icon: PlusCircle,
      color: "#22c55e",
      bg: "rgba(34,197,94,0.15)",
    },
    {
      id: "withdraw" as ModalType,
      label: "Withdraw",
      icon: MinusCircle,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.15)",
    },
    {
      id: "loan" as ModalType,
      label: "Take a Loan",
      icon: Landmark,
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.15)",
    },
    {
      id: "repay" as ModalType,
      label: "Repay Loan",
      icon: RefreshCcw,
      color: "#a855f7",
      bg: "rgba(168,85,247,0.15)",
    },
    {
      id: "details" as ModalType,
      label: "Account Info",
      icon: Info,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
    },
  ];

  const txIcons: Record<string, React.ReactNode> = {
    deposit: <ArrowDownRight className="w-4 h-4" style={{ color: "#22c55e" }} />,
    withdrawal: <ArrowUpRight className="w-4 h-4" style={{ color: "#ef4444" }} />,
    loan: <Landmark className="w-4 h-4" style={{ color: "#3b82f6" }} />,
    repayment: <RefreshCcw className="w-4 h-4" style={{ color: "#a855f7" }} />,
  };

  return (
    <div className="relative size-full overflow-auto">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url("https://images.unsplash.com/photo-1778429557352-ea4213f69e91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxncmFuZCUyMGNsYXNzaWNhbCUyMGJhbmslMjBidWlsZGluZyUyMGFyY2hpdGVjdHVyZSUyMGZhY2FkZXxlbnwxfHx8fDE3ODI5Nzc3NTZ8MA&ixlib=rb-4.1.0&q=80&w=1080")`,
        }}
      />
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-amber-900/60" />

      <div className="relative z-10 min-h-full p-4 md:p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ background: "linear-gradient(135deg, #d4a017, #b8860b)" }}
            >
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white" style={{ fontWeight: 700, fontSize: "1rem" }}>
                VaultBank
              </p>
              <p className="text-slate-400" style={{ fontSize: "0.7rem" }}>
                Premium Banking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                {user.username}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#fca5a5",
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto space-y-5">
          {/* Hero balance */}
          <div
            className="rounded-2xl p-6 md:p-8"
            style={{
              background:
                "linear-gradient(135deg, rgba(212,160,23,0.25) 0%, rgba(184,134,11,0.15) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(212,160,23,0.3)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p
                  className="text-amber-300 mb-1"
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Total Balance
                </p>
                <p
                  className="text-white"
                  style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}
                >
                  {formatINR(user.balance)}
                </p>
                <p className="text-slate-300 mt-2" style={{ fontSize: "0.8rem" }}>
                  Welcome back,{" "}
                  <span className="text-amber-300 font-semibold">{user.username}</span>!
                </p>
              </div>
              <div className="flex gap-3">
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: "rgba(255,255,255,0.08)", minWidth: 110 }}
                >
                  <IndianRupee className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-slate-400" style={{ fontSize: "0.7rem" }}>
                    Loan Balance
                  </p>
                  <p className="text-white" style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {formatINR(user.loanBalance)}
                  </p>
                </div>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: "rgba(255,255,255,0.08)", minWidth: 110 }}
                >
                  <TrendingUp
                    className="w-5 h-5 mx-auto mb-1"
                    style={{ color: creditInfo.color }}
                  />
                  <p className="text-slate-400" style={{ fontSize: "0.7rem" }}>
                    Credit Score
                  </p>
                  <p
                    style={{ fontWeight: 700, fontSize: "0.95rem", color: creditInfo.color }}
                  >
                    {user.creditScore}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Account No.", value: user.accountNumber, icon: CreditCard, color: "#f59e0b" },
              { label: "Credit Rating", value: creditInfo.label, icon: Shield, color: creditInfo.color },
              { label: "Available", value: formatINR(user.balance), icon: IndianRupee, color: "#22c55e" },
              { label: "Loan Balance", value: formatINR(user.loanBalance), icon: Landmark, color: "#3b82f6" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  <span className="text-slate-400" style={{ fontSize: "0.7rem" }}>
                    {stat.label}
                  </span>
                </div>
                <p
                  className="text-white"
                  style={{ fontWeight: 600, fontSize: "0.85rem", wordBreak: "break-all" }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div>
            <p
              className="text-slate-400 mb-3"
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Quick Actions
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {actions.map((action) => (
                <button
                  key={String(action.id)}
                  onClick={() => setActiveModal(action.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200"
                  style={{
                    background: action.bg,
                    border: `1px solid ${action.color}30`,
                    backdropFilter: "blur(12px)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${action.color}20` }}
                  >
                    <action.icon className="w-5 h-5" style={{ color: action.color }} />
                  </div>
                  <span
                    className="text-white"
                    style={{ fontSize: "0.78rem", fontWeight: 500, textAlign: "center" }}
                  >
                    {action.label}
                  </span>
                  <ChevronRight
                    className="w-3 h-3"
                    style={{ color: action.color, opacity: 0.6 }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* API error banner */}
          {actionError && (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
                fontSize: "0.85rem",
              }}
            >
              {actionError}
            </div>
          )}

          {/* Transaction History */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-white" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  Recent Transactions
                </span>
              </div>
              <span className="text-slate-500" style={{ fontSize: "0.75rem" }}>
                {transactions.length} records
              </span>
            </div>
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                <Clock className="w-8 h-8 mb-2 opacity-40" />
                <p style={{ fontSize: "0.85rem" }}>No transactions yet</p>
                <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  Start by making a deposit
                </p>
              </div>
            ) : (
              <div>
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-5 py-3 border-b last:border-0"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        {txIcons[tx.type]}
                      </div>
                      <div>
                        <p
                          className="text-white"
                          style={{ fontSize: "0.85rem", fontWeight: 500 }}
                        >
                          {tx.description}
                        </p>
                        <p className="text-slate-500" style={{ fontSize: "0.72rem" }}>
                          {tx.date}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color:
                          tx.type === "deposit" || tx.type === "loan"
                            ? "#22c55e"
                            : "#ef4444",
                      }}
                    >
                      {tx.type === "deposit" || tx.type === "loan" ? "+" : "-"}
                      {formatINR(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Modals */}
      {activeModal && activeModal !== "details" && (
        <ActionModal
          type={activeModal as "deposit" | "withdraw" | "loan" | "repay"}
          user={user}
          loading={actionLoading}
          onConfirm={(amount, desc, months) =>
            handleAction(activeModal as any, amount, desc, months)
          }
          onClose={() => {
            setActiveModal(null);
            setActionError("");
          }}
        />
      )}

      {/* Account Details Modal */}
      {activeModal === "details" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10,15,28,0.97)",
              border: "1px solid rgba(212,160,23,0.3)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-6 py-5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(245,158,11,0.08)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #d4a017, #b8860b)" }}
              >
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-white" style={{ fontWeight: 700 }}>
                Account Details
              </h2>
            </div>

            <div className="p-6">
              {detailsLoading && (
                <p className="text-slate-400 text-center py-4" style={{ fontSize: "0.85rem" }}>
                  Loading...
                </p>
              )}
              {detailsError && (
                <div
                  className="rounded-xl px-3 py-2 mb-4"
                  style={{
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#fca5a5",
                    fontSize: "0.8rem",
                  }}
                >
                  {detailsError}
                </div>
              )}

              {/* Always show live user data; show API extras if available */}
              {[
                {
                  label: "Account Holder",
                  value: accountDetails?.customerName || user.username,
                },
                {
                  label: "Account Number",
                  value: user.accountNumber,
                },
                {
                  label: "Current Balance",
                  value: formatINR(accountDetails?.balance ?? user.balance),
                },
                {
                  label: "Loan Balance",
                  value: formatINR(accountDetails?.loanBalance ?? user.loanBalance),
                },
                {
                  label: "Credit Score",
                  value: `${accountDetails?.creditScore ?? user.creditScore} — ${
                    getCreditLabel(accountDetails?.creditScore ?? user.creditScore).label
                  }`,
                },
                ...(accountDetails?.createdAt
                  ? [
                      {
                        label: "Account Created",
                        value: new Date(accountDetails.createdAt).toLocaleDateString("en-IN"),
                      },
                      {
                        label: "Last Updated",
                        value: new Date(accountDetails.updatedAt).toLocaleDateString("en-IN"),
                      },
                    ]
                  : []),
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between py-2.5 border-b last:border-0"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <span className="text-slate-400" style={{ fontSize: "0.82rem" }}>
                    {row.label}
                  </span>
                  <span
                    className="text-white"
                    style={{ fontWeight: 600, fontSize: "0.82rem", textAlign: "right", maxWidth: "55%" }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}

              <button
                onClick={() => setActiveModal(null)}
                className="w-full mt-5 py-3 rounded-xl"
                style={{
                  background: "linear-gradient(135deg, #d4a017, #b8860b)",
                  color: "#fff",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

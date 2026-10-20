import { useCallback, useEffect, useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { Dashboard, type BankUser } from "./components/Dashboard";
import bankService from "./services/bankService";
import { loadSession, onSessionChange } from "./services/citySession";

/**
 * The bank UI uses the city's shared session (localStorage "city.session"):
 *  - reload the page / open it from the city      -> you are still signed in (token is checked with the bank)
 *  - sign in at the city gate or any district      -> you are signed in here
 *  - sign out / token expires anywhere             -> back to the login screen here too
 */
export default function App() {
  const [user, setUser] = useState<BankUser | null>(null);
  const [booting, setBooting] = useState(true);

  const restore = useCallback(async () => {
    const s = loadSession();
    if (!s) {
      setUser(null);
      setBooting(false);
      return;
    }
    try {
      const res = await bankService.getAccountById(s.accountId);
      if (res?.data) {
        setUser({
          username: s.username,
          accountNumber: res.data.accountNumber ?? s.accountNumber,
          accountId: s.accountId,
          balance: res.data.balance,
          creditScore: res.data.creditScore,
          loanBalance: res.data.loanBalance,
        });
      }
    } catch {
      // 401 already cleared the session; if the bank is just down keep the person on the login screen
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    restore();
    const off = onSessionChange(() => {
      if (!loadSession()) setUser(null);
      else restore();
    });
    const expired = () => setUser(null);
    window.addEventListener("city:session-expired", expired);
    return () => {
      off();
      window.removeEventListener("city:session-expired", expired);
    };
  }, [restore]);

  if (booting) {
    return <div className="city-boot" aria-busy="true" />;
  }

  return user ? (
    <Dashboard
      user={user}
      onLogout={() => {
        bankService.logout();
        setUser(null);
      }}
      onUpdateUser={setUser}
    />
  ) : (
    <LoginPage onLogin={setUser} />
  );
}

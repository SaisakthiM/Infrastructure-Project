import { useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { Dashboard, type BankUser } from "./components/Dashboard";

export default function App() {
  const [user, setUser] = useState<BankUser | null>(null);

  return user ? (
    <Dashboard
      user={user}
      onLogout={() => setUser(null)}
      onUpdateUser={setUser}
    />
  ) : (
    <LoginPage onLogin={setUser} />
  );
}

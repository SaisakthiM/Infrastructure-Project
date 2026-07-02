import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AddNote from "./notes/AddNote.jsx";
import HomePage from "./notes/Notes.jsx";
import LoginPage from "./components/Login.jsx";
import RegisterPage from "./components/Register.jsx";
import RegistrationComplete from "./components/RegistrationComplete.jsx";
import DeleteNote from "./notes/DeleteNote.jsx";
import ModifyNote from "./notes/ModifyNote.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Router basename="/notes/">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/registered" element={<RegistrationComplete />} />
          <Route path="/addnote" element={<AddNote></AddNote>}></Route>
          <Route path="/modifynote" element={<ModifyNote/>}></Route>
          <Route path="/deletenote" element={<DeleteNote></DeleteNote>}></Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

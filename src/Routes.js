import { Navigate, Route, Routes } from "react-router-dom";
import AdminPanelPage from "./pages/AdminPanelPage.jsx";
import AtendentePanel from "./pages/AtendentePanel.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import ClientDashboardPage from "./pages/ClientDashboardPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PrivateRoute from "./routes/PrivateRoute.js";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />

      <Route element={<PrivateRoute allowedRoles={["CLIENTE"]} />}>
        <Route path="/dashboard" element={<ClientDashboardPage />} />
      </Route>

      <Route element={<PrivateRoute allowedRoles={["ATENDENTE"]} />}>
        <Route path="/atendente" element={<AtendentePanel />} />
      </Route>

      <Route
        element={
          <PrivateRoute allowedRoles={["ADMIN", "FUNCIONARIO", "COZINHA"]} />
        }
      >
        <Route path="/admin" element={<AdminPanelPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;

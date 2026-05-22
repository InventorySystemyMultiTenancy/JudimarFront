import { Navigate, Route, Routes } from "react-router-dom";
import AdminPanelPage from "./pages/AdminPanelPage.jsx";
import AdminProductsPage from "./pages/AdminProductsPage.jsx";
import AdminProductsHubPage from "./pages/AdminProductsHubPage.jsx";
import AtendentePanel from "./pages/AtendentePanel.jsx";
import AdminOrderHistoryPage from "./pages/AdminOrderHistoryPage.jsx";
import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import AdminMesasPage from "./pages/AdminMesasPage.jsx";
import SalesAnalyticsPage from "./pages/SalesAnalyticsPage.jsx";
import CardapioPage from "./pages/CardapioPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import CheckoutReturnPage from "./pages/CheckoutReturnPage.jsx";
import ClientDashboardPage from "./pages/ClientDashboardPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import KitchenPage from "./pages/KitchenPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MotoboyPage from "./pages/MotoboyPage.jsx";
import MesaAccessPage from "./pages/MesaAccessPage.jsx";
import MesaCheckoutPage from "./pages/MesaCheckoutPage.jsx";
import MesaCardapioPage from "./pages/MesaCardapioPage.jsx";
import AdminMesaCardapioPage from "./pages/AdminMesaCardapioPage.jsx";
import ComandasPage from "./pages/ComandasPage.jsx";
import ComandaSummaryPage from "./pages/ComandaSummaryPage.jsx";
import CaixaPage from "./pages/CaixaPage.jsx";
import PrivateRoute from "./routes/PrivateRoute.js";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/cardapio" element={<CardapioPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/checkout/retorno" element={<CheckoutReturnPage />} />

      {/* Acesso de mesa via QR code (público) */}
      <Route path="/mesa/:token" element={<MesaAccessPage />} />
      <Route path="/cardapio-mesa/:token" element={<MesaAccessPage />} />

      {/* Página somente leitura do cardápio para mesas — rota separada da sessão de pedidos /mesa */}
      <Route element={<PrivateRoute allowedRoles={["MESA"]} />}>
        <Route path="/cardapio-mesa" element={<MesaCardapioPage />} />
        <Route path="/mesa/checkout" element={<MesaCheckoutPage />} />
      </Route>

      <Route
        element={
          <PrivateRoute
            allowedRoles={[
              "CLIENTE",
              "ADMIN",
              "FUNCIONARIO",
              "ATENDENTE",
              "COZINHA",
            ]}
          />
        }
      >
        <Route path="/checkout" element={<CheckoutPage />} />
      </Route>

      <Route element={<PrivateRoute allowedRoles={["CLIENTE"]} />}>
        <Route path="/dashboard" element={<ClientDashboardPage />} />
      </Route>

      <Route
        element={
          <PrivateRoute
            allowedRoles={["COZINHA", "ADMIN", "FUNCIONARIO", "ATENDENTE"]}
          />
        }
      >
        <Route path="/cozinha" element={<KitchenPage />} />
      </Route>

      <Route
        element={
          <PrivateRoute allowedRoles={["ADMIN", "FUNCIONARIO", "ATENDENTE"]} />
        }
      >
        <Route path="/comandas" element={<ComandasPage />} />
        <Route path="/comandas/:token" element={<ComandaSummaryPage />} />
        <Route path="/caixa" element={<CaixaPage />} />
      </Route>

      <Route element={<PrivateRoute allowedRoles={["ATENDENTE"]} />}>
        <Route path="/atendente" element={<AtendentePanel />} />
      </Route>

      <Route element={<PrivateRoute allowedRoles={["ADMIN", "FUNCIONARIO"]} />}>
        <Route path="/admin" element={<AdminPanelPage />} />
        <Route path="/admin/produtos" element={<AdminProductsHubPage />} />
        <Route path="/admin/produtos/lista" element={<AdminProductsPage />} />
        <Route path="/admin/vendas" element={<SalesAnalyticsPage />} />
        <Route path="/admin/historico" element={<AdminOrderHistoryPage />} />
        <Route path="/admin/usuarios" element={<AdminUsersPage />} />
        <Route path="/admin/mesas" element={<AdminMesasPage />} />
        <Route
          path="/admin/cardapio-mesa"
          element={<AdminMesaCardapioPage />}
        />
      </Route>

      <Route
        element={
          <PrivateRoute allowedRoles={["MOTOBOY", "ADMIN", "FUNCIONARIO"]} />
        }
      >
        <Route path="/motoboy" element={<MotoboyPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;

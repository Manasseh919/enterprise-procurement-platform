import { NavLink, Route, Routes } from "react-router-dom";
import { Analytics } from "./pages/Analytics";
import { Dashboard } from "./pages/Dashboard";
import { Integrations } from "./pages/Integrations";
import { PurchaseOrders } from "./pages/PurchaseOrders";

export function App() {
  return (
    <div className="layout">
      <header className="header">
        <div className="brand">Enterprise Procurement</div>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/purchase-orders">Purchase Orders</NavLink>
          <NavLink to="/integrations">Integrations</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  );
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Purchases from "./pages/Purchases";
import Sales from "./pages/Sales";
import Movements from "./pages/Movements";
import MovementsHistory from "./pages/MovementsHistory";
import Employees from "./pages/Employees";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";
import Company from "./pages/Company";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/layout/AppLayout";
import Inventory from "./pages/Inventory";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route element={<AppLayout />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/machines" element={<Machines />} />
            <Route path="/app/products" element={<Products />} />
            <Route path="/app/inventory" element={<Inventory />} />
            <Route path="/app/products/:id" element={<ProductDetail />} />
            <Route path="/app/purchases" element={<Purchases />} />
            <Route path="/app/sales" element={<Sales />} />
            <Route path="/app/movements" element={<Movements />} />
            <Route path="/app/movements/history" element={<MovementsHistory />} />
            <Route path="/app/employees" element={<Employees />} />
            <Route path="/app/customers" element={<Customers />} />
            <Route path="/app/suppliers" element={<Suppliers />} />
            <Route path="/app/reports" element={<Reports />} />
            <Route path="/app/company" element={<Company />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

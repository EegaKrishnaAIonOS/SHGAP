import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MobileShell } from "./layouts/MobileShell";
import { DashboardShell } from "./layouts/DashboardShell";
import { useHtmlLangSync } from "./i18n/useHtmlLangSync";
import { HomePage } from "./pages/HomePage";
import { RegistrationPage } from "./pages/shg/RegistrationPage";
import { ProductCataloguePage } from "./pages/shg/ProductCataloguePage";
import { VoiceAssistantPage } from "./pages/shg/VoiceAssistantPage";
import { DistrictDashboardPage } from "./pages/dashboards/DistrictDashboardPage";
import { UlbDashboardPage } from "./pages/dashboards/UlbDashboardPage";
import { ShgDashboardPage } from "./pages/dashboards/ShgDashboardPage";
import { ProductDashboardPage } from "./pages/dashboards/ProductDashboardPage";
import { BuyerDashboardPage } from "./pages/dashboards/BuyerDashboardPage";
import { GovernmentDashboardPage } from "./pages/dashboards/GovernmentDashboardPage";
import { AdminPage } from "./pages/admin/AdminPage";

function App() {
  // Keeps <html lang> (and therefore the Telugu font-stack CSS rule) in
  // sync with the active i18next language across the whole app.
  useHtmlLangSync();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* SHG-member-facing screens: mobile-first shell. */}
        <Route element={<MobileShell />}>
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/catalogue" element={<ProductCataloguePage />} />
          <Route path="/voice-assistant" element={<VoiceAssistantPage />} />
        </Route>

        {/* Official-facing screens: data-dense desktop shell. */}
        <Route element={<DashboardShell />}>
          <Route path="/dashboards/district" element={<DistrictDashboardPage />} />
          <Route path="/dashboards/ulb" element={<UlbDashboardPage />} />
          <Route path="/dashboards/shg" element={<ShgDashboardPage />} />
          <Route path="/dashboards/product" element={<ProductDashboardPage />} />
          <Route path="/dashboards/buyer" element={<BuyerDashboardPage />} />
          <Route path="/dashboards/government" element={<GovernmentDashboardPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

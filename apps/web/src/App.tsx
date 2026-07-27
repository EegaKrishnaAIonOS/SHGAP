import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MobileShell } from "./layouts/MobileShell";
import { DashboardShell } from "./layouts/DashboardShell";
import { useHtmlLangSync } from "./i18n/useHtmlLangSync";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequireRole } from "./components/RequireRole";
import { initOfflineSync } from "./lib/offlineQueue/sync";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegistrationPage } from "./pages/shg/RegistrationPage";
import { ProductCataloguePage } from "./pages/shg/ProductCataloguePage";
import { VoiceAssistantPage } from "./pages/shg/VoiceAssistantPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminShgsPage } from "./pages/admin/AdminShgsPage";
import { AdminProductsPage } from "./pages/admin/AdminProductsPage";
import { AdminMasterDataPage } from "./pages/admin/AdminMasterDataPage";

// Lazy-loaded: these dashboards pull in leaflet/jspdf/xlsx (T19), which are
// heavy and only ever needed by officials on the desktop dashboard shell —
// splitting them out of the main chunk keeps the SHG-member-facing PWA app
// shell (the thing that actually needs to precache well on flaky connectivity)
// small, and fixes the workbox 2 MiB precache-size limit for the main bundle.
const DistrictDashboardPage = lazy(() =>
  import("./pages/dashboards/DistrictDashboardPage").then((m) => ({
    default: m.DistrictDashboardPage,
  })),
);
const UlbDashboardPage = lazy(() =>
  import("./pages/dashboards/UlbDashboardPage").then((m) => ({ default: m.UlbDashboardPage })),
);
const ShgDashboardPage = lazy(() =>
  import("./pages/dashboards/ShgDashboardPage").then((m) => ({ default: m.ShgDashboardPage })),
);
const ProductDashboardPage = lazy(() =>
  import("./pages/dashboards/ProductDashboardPage").then((m) => ({
    default: m.ProductDashboardPage,
  })),
);
const BuyerDashboardPage = lazy(() =>
  import("./pages/dashboards/BuyerDashboardPage").then((m) => ({ default: m.BuyerDashboardPage })),
);
const GovernmentDashboardPage = lazy(() =>
  import("./pages/dashboards/GovernmentDashboardPage").then((m) => ({
    default: m.GovernmentDashboardPage,
  })),
);

const ADMIN_PORTAL_ROLES = ["ADMIN", "STATE_OFFICIAL", "DISTRICT_OFFICIAL", "ULB_OFFICIAL"];

function DashboardFallback() {
  const { t } = useTranslation();
  return <div className="p-6 text-sm text-neutral-500">{t("common.loading")}</div>;
}

function App() {
  // Keeps <html lang> (and therefore the Telugu font-stack CSS rule) in
  // sync with the active i18next language across the whole app.
  useHtmlLangSync();

  // Replays any queued offline mutations as soon as the browser reports
  // it's back online (and once at startup if already online).
  useEffect(() => {
    initOfflineSync();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* SHG-member-facing screens: mobile-first shell, gated behind phone-OTP login. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MobileShell />}>
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/catalogue" element={<ProductCataloguePage />} />
              <Route path="/voice-assistant" element={<VoiceAssistantPage />} />
            </Route>
          </Route>

          {/* Official-facing screens: data-dense desktop shell, auth + role-gated
              since the analytics endpoints they call are RBAC-enforced (T18/T19). */}
          <Route element={<DashboardShell />}>
            <Route element={<ProtectedRoute />}>
              <Route element={<RequireRole roles={ADMIN_PORTAL_ROLES} />}>
                <Route
                  path="/dashboards/district"
                  element={
                    <Suspense fallback={<DashboardFallback />}>
                      <DistrictDashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/dashboards/ulb"
                  element={
                    <Suspense fallback={<DashboardFallback />}>
                      <UlbDashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/dashboards/shg"
                  element={
                    <Suspense fallback={<DashboardFallback />}>
                      <ShgDashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/dashboards/product"
                  element={
                    <Suspense fallback={<DashboardFallback />}>
                      <ProductDashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/dashboards/buyer"
                  element={
                    <Suspense fallback={<DashboardFallback />}>
                      <BuyerDashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/dashboards/government"
                  element={
                    <Suspense fallback={<DashboardFallback />}>
                      <GovernmentDashboardPage />
                    </Suspense>
                  }
                />

                {/* Admin portal (T09). */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminOverviewPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="shgs" element={<AdminShgsPage />} />
                  <Route path="products" element={<AdminProductsPage />} />
                  <Route element={<RequireRole roles={["ADMIN"]} />}>
                    <Route path="master-data" element={<AdminMasterDataPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

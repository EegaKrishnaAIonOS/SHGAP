import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/cn";

/**
 * Sub-navigation for the admin portal (T09) — Master Data is only shown to
 * ADMIN, since district/ULB/state officials can view and moderate SHGs/
 * products/users within their scope but shouldn't be able to edit
 * platform-wide configuration (the backend enforces this too; see
 * ADR-0018).
 */
export function AdminLayout() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");

  const tabs = [
    { to: "/admin", end: true, label: "Overview" },
    { to: "/admin/users", label: "Users" },
    { to: "/admin/shgs", label: "SHGs" },
    { to: "/admin/products", label: "Products" },
    ...(isAdmin
      ? [
          { to: "/admin/approvals", label: "Approvals" },
          { to: "/admin/master-data", label: "Master data" },
        ]
      : []),
  ];

  return (
    <div>
      <nav aria-label="Admin overview" className="mb-5 border-b border-neutral-200">
        <ul className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    "block rounded-t-md border-b-2 px-3 py-2 text-sm font-medium",
                    isActive
                      ? "border-brand-400 text-brand-500"
                      : "border-transparent text-neutral-600 hover:text-neutral-900",
                  )
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}

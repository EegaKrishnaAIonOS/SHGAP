import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { DataTable, type Column } from "../../components/ui/Table";
import { approveUser, getPendingUsers, rejectUser } from "../../lib/api/admin";
import type { UserProfile } from "../../lib/api/types";

/** Minimal admin approval screen (T25) — SHG/Distributor self-registrations
 * only; Consumer accounts activate immediately and never appear here (see
 * AdminService.listPendingUsers on the backend). */
export function AdminApprovalsPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    getPendingUsers()
      .then(setUsers)
      .catch(() => setError(t("admin.approvals.loadError")))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [t]);

  async function handleDecision(user: UserProfile, decision: "approve" | "reject") {
    setPendingId(user.id);
    setError(null);
    try {
      await (decision === "approve" ? approveUser(user.id) : rejectUser(user.id));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      setError(t("admin.approvals.updateError"));
    } finally {
      setPendingId(null);
    }
  }

  const columns: Column<UserProfile>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name ?? "—" },
    { key: "email", header: t("admin.approvals.email"), render: (row) => row.email ?? "—" },
    { key: "phone", header: t("admin.phone"), render: (row) => row.phone },
    {
      key: "role",
      header: t("admin.role"),
      render: (row) => row.userRoles.map((ur) => ur.role.name).join(", ") || "—",
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            isLoading={pendingId === row.id}
            onClick={() => void handleDecision(row, "approve")}
          >
            {t("admin.approvals.approve")}
          </Button>
          <Button
            size="sm"
            variant="danger"
            isLoading={pendingId === row.id}
            onClick={() => void handleDecision(row, "reject")}
          >
            {t("admin.approvals.reject")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.approvals.title")}
        subtitle={t("admin.approvals.subtitle")}
        wireframe={false}
      />

      <Card>
        {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(row) => row.id}
          emptyMessage={loading ? t("common.loading") : t("admin.approvals.noneFound")}
        />
      </Card>
    </div>
  );
}

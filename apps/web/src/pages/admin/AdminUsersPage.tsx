import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DataTable, type Column } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { listUsers, updateUserStatus } from "../../lib/api/users";
import type { UserProfile } from "../../lib/api/types";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

export function AdminUsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      listUsers({ page, pageSize: PAGE_SIZE, search: search.trim() || undefined })
        .then((result) => {
          if (cancelled) return;
          setUsers(result.items);
          setTotalPages(result.totalPages);
          setTotal(result.total);
        })
        .catch(() => {
          if (!cancelled) setError(t("admin.usersLoadError"));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, page, t]);

  async function toggleStatus(user: UserProfile) {
    setPendingId(user.id);
    try {
      const nextStatus = user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
      const updated = await updateUserStatus(user.id, nextStatus);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setError(t("admin.usersUpdateError"));
    } finally {
      setPendingId(null);
    }
  }

  const columns: Column<UserProfile>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name ?? "—" },
    { key: "phone", header: t("admin.phone"), render: (row) => row.phone },
    {
      key: "roles",
      header: t("admin.role"),
      render: (row) => row.userRoles.map((ur) => ur.role.name).join(", ") || "—",
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => (
        <span
          className={
            row.status === "SUSPENDED"
              ? "rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700"
              : "rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700"
          }
        >
          {row.status ?? "ACTIVE"}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row) => (
        <Button
          size="sm"
          variant={row.status === "SUSPENDED" ? "primary" : "outline"}
          isLoading={pendingId === row.id}
          onClick={() => void toggleStatus(row)}
        >
          {row.status === "SUSPENDED" ? t("admin.reactivate") : t("admin.suspend")}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t("admin.tabUsers")} wireframe={false} />

      <Card>
        <div className="mb-4 max-w-sm">
          <Input
            label={t("common.search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("admin.usersSearchPlaceholder")}
          />
        </div>

        {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

        <DataTable
          columns={columns}
          rows={users}
          rowKey={(row) => row.id}
          emptyMessage={loading ? t("common.loading") : t("admin.noUsersFound")}
        />

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}

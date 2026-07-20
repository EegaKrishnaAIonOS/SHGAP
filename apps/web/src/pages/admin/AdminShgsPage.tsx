import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DataTable, type Column } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { listShgs, updateShg } from "../../lib/api/shgs";
import type { Shg } from "../../lib/api/types";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

export function AdminShgsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [shgs, setShgs] = useState<Shg[]>([]);
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
      listShgs({ page, pageSize: PAGE_SIZE, search: search.trim() || undefined })
        .then((result) => {
          if (cancelled) return;
          setShgs(result.items);
          setTotalPages(result.totalPages);
          setTotal(result.total);
        })
        .catch(() => {
          if (!cancelled) setError(t("admin.shgsLoadError"));
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

  async function toggleActive(shg: Shg) {
    setPendingId(shg.id);
    try {
      const result = await updateShg(shg.id, { isActive: !shg.isActive });
      if (result.status === "ok") {
        setShgs((prev) => prev.map((s) => (s.id === result.data.id ? result.data : s)));
      } else {
        setError(t("admin.actionQueuedOffline"));
      }
    } catch {
      setError(t("admin.shgsUpdateError"));
    } finally {
      setPendingId(null);
    }
  }

  const columns: Column<Shg>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "type", header: t("catalogue.form.category"), render: (row) => row.type },
    {
      key: "district",
      header: t("registration.district"),
      render: (row) => row.district?.name ?? "—",
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => (
        <span
          className={
            row.isActive
              ? "rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700"
              : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
          }
        >
          {row.isActive ? t("catalogue.available") : t("catalogue.unavailable")}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row) => (
        <Button
          size="sm"
          variant={row.isActive ? "outline" : "primary"}
          isLoading={pendingId === row.id}
          onClick={() => void toggleActive(row)}
        >
          {row.isActive ? t("admin.deactivate") : t("admin.reactivate")}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t("admin.tabShgs")} wireframe={false} />

      <Card>
        <div className="mb-4 max-w-sm">
          <Input
            label={t("common.search")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("admin.shgsSearchPlaceholder")}
          />
        </div>

        {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

        <DataTable
          columns={columns}
          rows={shgs}
          rowKey={(row) => row.id}
          emptyMessage={loading ? t("common.loading") : t("admin.noShgsFound")}
        />

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}

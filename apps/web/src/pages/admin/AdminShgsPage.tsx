import { useEffect, useState } from "react";
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
          if (!cancelled) setError("Couldn't load SHGs. Please try again.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, page]);

  async function toggleActive(shg: Shg) {
    setPendingId(shg.id);
    try {
      const result = await updateShg(shg.id, { isActive: !shg.isActive });
      if (result.status === "ok") {
        setShgs((prev) => prev.map((s) => (s.id === result.data.id ? result.data : s)));
      } else {
        setError("You're offline — this change will sync automatically once you're back online.");
      }
    } catch {
      setError("Couldn't update this SHG. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  const columns: Column<Shg>[] = [
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "type", header: "Category", render: (row) => row.type },
    {
      key: "district",
      header: "District",
      render: (row) => row.district?.name ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={
            row.isActive
              ? "rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700"
              : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
          }
        >
          {row.isActive ? "Available" : "Unavailable"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <Button
          size="sm"
          variant={row.isActive ? "outline" : "primary"}
          isLoading={pendingId === row.id}
          onClick={() => void toggleActive(row)}
        >
          {row.isActive ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="SHGs" wireframe={false} />

      <Card>
        <div className="mb-4 max-w-sm">
          <Input
            label="Search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by SHG name"
          />
        </div>

        {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

        <DataTable
          columns={columns}
          rows={shgs}
          rowKey={(row) => row.id}
          emptyMessage={loading ? "Loading..." : "No SHGs found."}
        />

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}

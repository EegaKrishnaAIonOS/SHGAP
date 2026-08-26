import { useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { DataTable, type Column } from "../../components/ui/Table";
import { Pagination } from "../../components/ui/Pagination";
import { listProducts, updateProduct } from "../../lib/api/products";
import type { Product } from "../../lib/api/types";

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

export function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
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
      listProducts({ page, pageSize: PAGE_SIZE, search: search.trim() || undefined })
        .then((result) => {
          if (cancelled) return;
          setProducts(result.items);
          setTotalPages(result.totalPages);
          setTotal(result.total);
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load products. Please try again.");
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

  async function toggleAvailable(product: Product) {
    setPendingId(product.id);
    try {
      const result = await updateProduct(product.id, { isAvailable: !product.isAvailable });
      if (result.status === "ok") {
        setProducts((prev) => prev.map((p) => (p.id === result.data.id ? result.data : p)));
      } else {
        setError("You're offline — this change will sync automatically once you're back online.");
      }
    } catch {
      setError("Couldn't update this product. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  const columns: Column<Product>[] = [
    { key: "name", header: "Product name", render: (row) => row.name },
    { key: "shg", header: "SHG", render: (row) => row.shg?.name ?? "—" },
    { key: "price", header: "Price", render: (row) => row.price },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={
            row.isAvailable
              ? "rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700"
              : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
          }
        >
          {row.isAvailable ? "Available" : "Unavailable"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <Button
          size="sm"
          variant={row.isAvailable ? "outline" : "primary"}
          isLoading={pendingId === row.id}
          onClick={() => void toggleAvailable(row)}
        >
          {row.isAvailable ? "Flag as unavailable" : "Reactivate"}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Products" wireframe={false} />

      <Card>
        <div className="mb-4 max-w-sm">
          <Input
            label="Search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by product name"
          />
        </div>

        {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

        <DataTable
          columns={columns}
          rows={products}
          rowKey={(row) => row.id}
          emptyMessage={loading ? "Loading..." : "No products found."}
        />

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      </Card>
    </div>
  );
}

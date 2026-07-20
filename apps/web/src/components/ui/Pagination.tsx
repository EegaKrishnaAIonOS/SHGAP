import { useTranslation } from "react-i18next";
import { Button } from "./Button";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Prev/next pager for admin data tables (T09) — the pilot's scale doesn't call for jump-to-page or page-size controls. */
export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-sm text-neutral-500">
        {t("common.paginationSummary", { page, totalPages, total })}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("common.previous")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/Card";
import { LanguageToggle } from "../../components/LanguageToggle";
import { useAsyncData } from "../../lib/useAsyncData";
import { listSentEnquiries } from "../../lib/api/enquiries";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  OPEN: "bg-warning-50 text-warning-700",
  RESPONDED: "bg-success-50 text-success-700",
  CLOSED: "bg-neutral-100 text-neutral-500",
};

/** A buyer's own submitted RFQs (Phase 2) — `ProtectedRoute`-wrapped but
 * standalone (no `MobileShell`): a buyer here is any logged-in user, not
 * necessarily an SHG member, so the SHG-facing mobile chrome doesn't fit. */
export function MyEnquiresPage() {
  const { t } = useTranslation();

  const { data: enquiries, loading, error } = useAsyncData(
    () => listSentEnquiries(),
    [],
    t("marketplace.myEnquiries.loadError"),
  );

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {t("marketplace.myEnquiries.title")}
          </h1>
          <Link to="/marketplace" className="mt-1 inline-block text-sm text-brand-500 underline">
            {t("marketplace.backToBrowse")}
          </Link>
        </div>
        <LanguageToggle />
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="text-neutral-500">{t("common.loading")}</p>
      ) : !enquiries || enquiries.length === 0 ? (
        <p className="text-neutral-500">{t("marketplace.myEnquiries.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {enquiries.map((enquiry) => (
            <Card key={enquiry.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {enquiry.product?.name ?? t("marketplace.myEnquiries.productUnavailable")}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {t("catalogue.byShg", { shg: enquiry.shg.name })}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[enquiry.status] ?? ""}`}
                >
                  {t(`marketplace.enquiryStatus.${enquiry.status}`)}
                </span>
              </div>
              {enquiry.message && (
                <p className="mt-2 text-sm text-neutral-700">{enquiry.message}</p>
              )}
              {enquiry.responseMessage && (
                <div className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-700">
                  <p className="mb-1 font-medium">{t("marketplace.myEnquiries.shgReplied")}</p>
                  <p>{enquiry.responseMessage}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
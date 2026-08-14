import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { listReceivedEnquiries, respondToEnquiry } from "../../lib/api/enquiries";
import type { Enquiry } from "../../lib/api/types";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  OPEN: "bg-warning-50 text-warning-700",
  RESPONDED: "bg-success-50 text-success-700",
  CLOSED: "bg-neutral-100 text-neutral-500",
};

function RespondForm({
  enquiry,
  onResponded,
}: {
  enquiry: Enquiry;
  onResponded: (updated: Enquiry) => void;
}) {
  const { t } = useTranslation();
  const [responseMessage, setResponseMessage] = useState(enquiry.responseMessage ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: "RESPONDED" | "CLOSED") {
    setSubmitting(true);
    setError(null);
    try {
      const result = await respondToEnquiry(enquiry.id, {
        status,
        responseMessage: responseMessage.trim() || undefined,
      });
      if (result.status === "ok") {
        onResponded(result.data);
      } else {
        setError(t("admin.actionQueuedOffline"));
      }
    } catch {
      setError(t("enquiries.respondFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
      <textarea
        rows={3}
        value={responseMessage}
        onChange={(e) => setResponseMessage(e.target.value)}
        placeholder={t("enquiries.responsePlaceholder")}
        className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1"
      />
      {error && <p className="text-sm text-danger-500">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" isLoading={submitting} onClick={() => void respond("RESPONDED")}>
          {t("enquiries.markResponded")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          isLoading={submitting}
          onClick={() => void respond("CLOSED")}
        >
          {t("enquiries.markClosed")}
        </Button>
      </div>
    </div>
  );
}

/** RFQs received by the caller's own SHG(s) (Phase 2) — `ProtectedRoute` +
 * `MobileShell`, alongside `/register`/`/catalogue`/`/voice-assistant`. */
export function EnquiriesReceivedPage() {
  const { t } = useTranslation();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listReceivedEnquiries()
      .then((result) => {
        if (!cancelled) setEnquiries(result);
      })
      .catch(() => {
        if (!cancelled) setError(t("enquiries.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  function handleResponded(updated: Enquiry) {
    setEnquiries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">{t("enquiries.title")}</h1>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      {loading ? (
        <p className="text-neutral-500">{t("common.loading")}</p>
      ) : enquiries.length === 0 ? (
        <p className="text-neutral-500">{t("enquiries.empty")}</p>
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
                    {t("enquiries.fromBuyer", { buyer: enquiry.buyer.name })}
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
              {enquiry.status === "CLOSED" ? (
                enquiry.responseMessage && (
                  <p className="mt-3 text-sm text-neutral-500">
                    {t("enquiries.yourReply")}: {enquiry.responseMessage}
                  </p>
                )
              ) : (
                <RespondForm enquiry={enquiry} onResponded={handleResponded} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
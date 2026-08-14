import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../context/AuthContext";
import { createEnquiry } from "../../lib/api/enquiries";
import { ApiError } from "../../lib/api/httpClient";
import type { Product } from "../../lib/api/types";

export interface EnquiryModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
}

/** RFQ submission form (Phase 2) — mirrors ProductFormModal.tsx's
 * submitting/submitError/queued-notice pattern, but much simpler: just a
 * message, plus (only for a first-time buyer with no profile name yet) a
 * name field. The caller is already confirmed logged-in before this opens
 * (see MarketplaceProductDetailPage.tsx). */
export function EnquiryModal({ open, onClose, product }: EnquiryModalProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [message, setMessage] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setBuyerName("");
    setSubmitError(null);
    setNotice(null);
    setSent(false);
  }, [open]);

  const needsBuyerName = !profile?.name;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setNotice(null);

    try {
      const result = await createEnquiry({
        productId: product.id,
        message: message.trim() || undefined,
        buyerName: needsBuyerName ? buyerName.trim() || undefined : undefined,
      });
      if (result.status === "ok") {
        setSent(true);
      } else {
        setNotice(t("marketplace.enquiry.queuedOffline"));
        setSent(true);
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : t("marketplace.enquiry.submitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("marketplace.enquiry.title", { product: product.name })}
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-neutral-700">{t("marketplace.enquiry.sentConfirmation")}</p>
          {notice && <p className="text-sm text-warning-700">{notice}</p>}
          <Button type="button" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
          {needsBuyerName && (
            <Input
              label={t("marketplace.enquiry.yourName")}
              fieldSize="touch"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="enquiry-message"
              className="text-sm font-medium text-neutral-700"
            >
              {t("marketplace.enquiry.message")}
            </label>
            <textarea
              id="enquiry-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("marketplace.enquiry.messagePlaceholder")}
              className="w-full rounded-md border border-neutral-300 bg-white p-3 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1"
            />
          </div>

          {submitError && (
            <p role="alert" className="text-sm text-danger-500">
              {submitError}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="touch" fullWidth onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="touch" fullWidth isLoading={submitting}>
              {t("marketplace.enquiry.submit")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
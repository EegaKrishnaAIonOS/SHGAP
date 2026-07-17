import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card, CardTitle } from "../../components/ui/Card";
import { getDistricts, getMandals, getUlbs } from "../../lib/api/masterData";
import { reverseGeocode } from "../../lib/api/geo";
import { createShg } from "../../lib/api/shgs";
import { SHG_TYPES } from "../../lib/api/types";
import type { District, Mandal, Ulb } from "../../lib/api/types";
import { ApiError } from "../../lib/api/httpClient";

const TOTAL_STEPS = 4;

interface FormState {
  name: string;
  type: (typeof SHG_TYPES)[number] | "";
  mepmaRegistrationNumber: string;
  productionCapacityNote: string;
  districtId: string;
  ulbId: string;
  mandalId: string;
  bankAccountNumber: string;
  bankIfsc: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "",
  mepmaRegistrationNumber: "",
  productionCapacityNote: "",
  districtId: "",
  ulbId: "",
  mandalId: "",
  bankAccountNumber: "",
  bankIfsc: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

/**
 * Real, API-wired SHG onboarding: 4 short steps instead of one long form
 * (group details -> location with an optional geo-tag suggestion -> optional
 * bank details -> review/submit), large touch targets throughout, and
 * client-side validation mirroring the server DTO constraints so members
 * get instant feedback instead of a round-trip 400. Phone/OTP verification
 * now happens once, globally, via /login — not as part of this form.
 */
export function RegistrationPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [districts, setDistricts] = useState<District[]>([]);
  const [ulbs, setUlbs] = useState<Ulb[]>([]);
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [loadingLocationOptions, setLoadingLocationOptions] = useState(false);

  const [geoStatus, setGeoStatus] = useState<"idle" | "detecting" | "done" | "error">("idle");
  const [geoSuggestion, setGeoSuggestion] = useState<{
    districtId: string;
    districtName: string;
  } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "queued">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getDistricts()
      .then(setDistricts)
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
  }, []);

  useEffect(() => {
    if (!form.districtId) {
      setUlbs([]);
      setMandals([]);
      return;
    }
    setLoadingLocationOptions(true);
    Promise.all([getUlbs(form.districtId), getMandals(form.districtId)])
      .then(([ulbList, mandalList]) => {
        setUlbs(ulbList);
        setMandals(mandalList);
      })
      .catch(() => {
        setUlbs([]);
        setMandals([]);
      })
      .finally(() => setLoadingLocationOptions(false));
  }, [form.districtId]);

  const typeOptions = useMemo(
    () => SHG_TYPES.map((value) => ({ value, label: t(`registration.type.${value}`) })),
    [t],
  );
  const districtOptions = useMemo(
    () => districts.map((d) => ({ value: d.id, label: d.name })),
    [districts],
  );
  const ulbOptions = useMemo(() => ulbs.map((u) => ({ value: u.id, label: u.name })), [ulbs]);
  const mandalOptions = useMemo(
    () => mandals.map((m) => ({ value: m.id, label: m.name })),
    [mandals],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep(current: number): boolean {
    const next: FieldErrors = {};
    if (current === 1) {
      if (!form.name.trim()) next.name = t("registration.errors.nameRequired");
      if (!form.type) next.type = t("registration.errors.typeRequired");
    }
    if (current === 2) {
      if (!form.districtId) next.districtId = t("registration.errors.districtRequired");
    }
    if (current === 3 && form.bankIfsc && form.bankIfsc.length !== 11) {
      next.bankIfsc = t("registration.errors.ifscLength");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function detectLocation() {
    setGeoStatus("detecting");
    setGeoSuggestion(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation unsupported"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setCoords({ lat, lng });
      const result = await reverseGeocode(lat, lng);
      if (result.suggestedDistrictId && result.suggestedDistrictName) {
        setGeoSuggestion({
          districtId: result.suggestedDistrictId,
          districtName: result.suggestedDistrictName,
        });
      }
      setGeoStatus("done");
    } catch {
      // Denied, unavailable, or Nominatim unreachable — never block
      // registration on this, just fall back to manual district selection.
      setGeoStatus("error");
    }
  }

  function acceptGeoSuggestion() {
    if (!geoSuggestion) return;
    updateField("districtId", geoSuggestion.districtId);
    setGeoSuggestion(null);
  }

  async function handleSubmit() {
    if (!validateStep(3) || !form.type) return;
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const result = await createShg({
        name: form.name.trim(),
        type: form.type,
        mepmaRegistrationNumber: form.mepmaRegistrationNumber.trim() || undefined,
        productionCapacityNote: form.productionCapacityNote.trim() || undefined,
        bankAccountNumber: form.bankAccountNumber.trim() || undefined,
        bankIfsc: form.bankIfsc.trim() || undefined,
        districtId: form.districtId,
        ulbId: form.ulbId || undefined,
        mandalId: form.mandalId || undefined,
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      setSubmitState(result.status === "ok" ? "done" : "queued");
    } catch (err) {
      setSubmitState("idle");
      setSubmitError(err instanceof ApiError ? err.message : t("registration.errors.submitFailed"));
    }
  }

  if (submitState === "done" || submitState === "queued") {
    return (
      <div>
        <Card className="text-center">
          <span className="mb-2 block text-4xl" aria-hidden="true">
            {submitState === "done" ? "✅" : "🔄"}
          </span>
          <CardTitle>
            {submitState === "done"
              ? t("registration.successTitle")
              : t("registration.queuedTitle")}
          </CardTitle>
          <p className="mt-2 text-neutral-600">
            {submitState === "done" ? t("registration.successBody") : t("registration.queuedBody")}
          </p>
          <Link
            to="/catalogue"
            className="mt-4 inline-flex min-h-touch items-center justify-center rounded-md bg-brand-400 px-6 text-lg font-medium text-white"
          >
            {t("registration.goToCatalogue")}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">{t("registration.title")}</h1>
      <p className="mb-4 text-sm font-medium text-brand-500">
        {t("registration.stepLabel", { current: step, total: TOTAL_STEPS })}
      </p>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < TOTAL_STEPS) {
            goNext();
          } else {
            void handleSubmit();
          }
        }}
      >
        {step === 1 && (
          <Card>
            <CardTitle className="mb-3">{t("registration.step1Title")}</CardTitle>
            <div className="flex flex-col gap-4">
              <Input
                label={t("registration.groupName")}
                hint={t("registration.groupNameHint")}
                fieldSize="touch"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                error={errors.name}
                required
              />
              <Select
                label={t("registration.type.label")}
                options={typeOptions}
                placeholder={t("registration.type.placeholder")}
                fieldSize="touch"
                value={form.type}
                onChange={(e) => updateField("type", e.target.value as FormState["type"])}
                error={errors.type}
                required
              />
              <Input
                label={t("registration.mepmaRegistrationNumber")}
                hint={t("registration.mepmaRegistrationNumberHint")}
                fieldSize="touch"
                value={form.mepmaRegistrationNumber}
                onChange={(e) => updateField("mepmaRegistrationNumber", e.target.value)}
              />
              <Input
                label={t("registration.productionCapacityNote")}
                fieldSize="touch"
                value={form.productionCapacityNote}
                onChange={(e) => updateField("productionCapacityNote", e.target.value)}
              />
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardTitle className="mb-3">{t("registration.step2Title")}</CardTitle>
            <div className="flex flex-col gap-4">
              <Button
                type="button"
                variant="secondary"
                size="touch"
                fullWidth
                isLoading={geoStatus === "detecting"}
                onClick={() => void detectLocation()}
              >
                <span aria-hidden="true">📍</span> {t("registration.detectLocation")}
              </Button>

              {geoSuggestion && (
                <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
                  <p className="mb-2">
                    {t("registration.geoSuggestion", { district: geoSuggestion.districtName })}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={acceptGeoSuggestion}>
                      {t("registration.geoSuggestionAccept")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setGeoSuggestion(null)}
                    >
                      {t("registration.geoSuggestionDismiss")}
                    </Button>
                  </div>
                </div>
              )}
              {geoStatus === "error" && (
                <p className="text-sm text-neutral-500">{t("registration.geoUnavailable")}</p>
              )}

              <Select
                label={t("registration.district")}
                options={districtOptions}
                placeholder={loadingDistricts ? t("common.loading") : t("dashboard.allDistricts")}
                fieldSize="touch"
                value={form.districtId}
                onChange={(e) => updateField("districtId", e.target.value)}
                error={errors.districtId}
                disabled={loadingDistricts}
                required
              />
              <Select
                label={t("registration.ulb")}
                options={ulbOptions}
                placeholder={
                  !form.districtId
                    ? t("registration.selectDistrictFirst")
                    : loadingLocationOptions
                      ? t("common.loading")
                      : t("registration.ulbOptional")
                }
                fieldSize="touch"
                value={form.ulbId}
                onChange={(e) => updateField("ulbId", e.target.value)}
                disabled={!form.districtId || loadingLocationOptions}
              />
              <Select
                label={t("registration.mandal")}
                options={mandalOptions}
                placeholder={
                  !form.districtId
                    ? t("registration.selectDistrictFirst")
                    : loadingLocationOptions
                      ? t("common.loading")
                      : t("registration.mandalOptional")
                }
                fieldSize="touch"
                value={form.mandalId}
                onChange={(e) => updateField("mandalId", e.target.value)}
                disabled={!form.districtId || loadingLocationOptions}
              />
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardTitle className="mb-3">{t("registration.step3Title")}</CardTitle>
            <p className="mb-3 text-sm text-neutral-500">{t("registration.bankDetailsHint")}</p>
            <div className="flex flex-col gap-4">
              <Input
                label={t("registration.bankAccountNumber")}
                inputMode="numeric"
                fieldSize="touch"
                value={form.bankAccountNumber}
                onChange={(e) => updateField("bankAccountNumber", e.target.value)}
              />
              <Input
                label={t("registration.bankIfsc")}
                hint={t("registration.bankIfscHint")}
                fieldSize="touch"
                maxLength={11}
                value={form.bankIfsc}
                onChange={(e) => updateField("bankIfsc", e.target.value.toUpperCase())}
                error={errors.bankIfsc}
              />
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardTitle className="mb-3">{t("registration.step4Title")}</CardTitle>
            <dl className="flex flex-col gap-2 text-sm">
              <ReviewRow label={t("registration.groupName")} value={form.name} />
              <ReviewRow
                label={t("registration.type.label")}
                value={t(`registration.type.${form.type}`)}
              />
              <ReviewRow
                label={t("registration.district")}
                value={districts.find((d) => d.id === form.districtId)?.name ?? ""}
              />
              {form.ulbId && (
                <ReviewRow
                  label={t("registration.ulb")}
                  value={ulbs.find((u) => u.id === form.ulbId)?.name ?? ""}
                />
              )}
              {form.mandalId && (
                <ReviewRow
                  label={t("registration.mandal")}
                  value={mandals.find((m) => m.id === form.mandalId)?.name ?? ""}
                />
              )}
            </dl>
            {submitError && (
              <p role="alert" className="mt-3 text-sm text-danger-500">
                {submitError}
              </p>
            )}
          </Card>
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" size="touch" fullWidth onClick={goBack}>
              {t("common.back")}
            </Button>
          )}
          <Button type="submit" size="touch" fullWidth isLoading={submitState === "submitting"}>
            {step < TOTAL_STEPS ? t("common.next") : t("registration.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-neutral-100 pb-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

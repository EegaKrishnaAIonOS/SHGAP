import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card, CardTitle } from "../../components/ui/Card";
import { WireframeBanner } from "../../components/WireframeBanner";

const TOTAL_STEPS = 3;

// Placeholder options — real district/mandal/village lists come from the
// MEPMA master-data API in a later sprint (T06+).
const DISTRICT_OPTIONS = [
  { value: "guntur", label: "Guntur" },
  { value: "krishna", label: "Krishna" },
  { value: "visakhapatnam", label: "Visakhapatnam" },
];

/**
 * SHG onboarding wireframe. Mobile-first, Telugu-first: one field group per
 * screen, large inputs/buttons, a simple linear 3-step flow instead of a
 * long single form, and an OTP-based verification step that avoids
 * password creation entirely (low digital literacy).
 */
export function RegistrationPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [otpSent, setOtpSent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  if (submitted) {
    return (
      <div>
        <WireframeBanner />
        <Card className="text-center">
          <span className="mb-2 block text-4xl" aria-hidden="true">
            ✅
          </span>
          <CardTitle>{t("registration.successTitle")}</CardTitle>
          <p className="mt-2 text-neutral-600">{t("registration.successBody")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <WireframeBanner />
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
            setSubmitted(true);
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
                required
              />
              <Input
                label={t("registration.memberCount")}
                type="number"
                min={1}
                fieldSize="touch"
                required
              />
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardTitle className="mb-3">{t("registration.step2Title")}</CardTitle>
            <div className="flex flex-col gap-4">
              <Select
                label={t("registration.district")}
                options={DISTRICT_OPTIONS}
                placeholder={t("dashboard.allDistricts")}
                fieldSize="touch"
                required
              />
              <Input label={t("registration.mandal")} fieldSize="touch" required />
              <Input label={t("registration.village")} fieldSize="touch" required />
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardTitle className="mb-3">{t("registration.step3Title")}</CardTitle>
            <div className="flex flex-col gap-4">
              <Input
                label={t("registration.phoneNumber")}
                type="tel"
                inputMode="numeric"
                fieldSize="touch"
                required
              />
              {!otpSent ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="touch"
                  onClick={() => setOtpSent(true)}
                >
                  {t("registration.sendOtp")}
                </Button>
              ) : (
                <Input
                  label={t("registration.otp")}
                  inputMode="numeric"
                  fieldSize="touch"
                  required
                />
              )}
              <label className="flex min-h-touch cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 text-neutral-500">
                <input type="file" accept="image/*" capture="environment" className="sr-only" />
                <span className="text-2xl" aria-hidden="true">
                  📷
                </span>
                <span className="text-sm font-medium">{t("registration.uploadPhoto")}</span>
                <span className="text-xs">{t("registration.uploadPhotoHint")}</span>
              </label>
            </div>
          </Card>
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" size="touch" fullWidth onClick={goBack}>
              {t("common.back")}
            </Button>
          )}
          <Button type="submit" size="touch" fullWidth>
            {step < TOTAL_STEPS ? t("common.next") : t("registration.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

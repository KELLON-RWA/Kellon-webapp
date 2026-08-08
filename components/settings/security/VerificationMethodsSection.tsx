import { Mail, MessageSquareText, ShieldCheck, Smartphone } from "lucide-react";
import type { OtpChannel, SecuritySettings } from "@/services/api/security";
import SecurityMethodRow from "./SecurityMethodRow";

interface VerificationMethodsSectionProps {
  settings: SecuritySettings;
  isLoading: boolean;
  isBusy: boolean;
  onOtpChange: (channel: OtpChannel, enabled: boolean) => void;
  onTotpChange: (enabled: boolean) => void;
  onBiometricsChange: (enabled: boolean) => void;
}

export default function VerificationMethodsSection({
  settings,
  isLoading,
  isBusy,
  onOtpChange,
  onTotpChange,
  onBiometricsChange,
}: VerificationMethodsSectionProps) {
  const disabled = isLoading || isBusy;

  return (
    <section aria-labelledby="verification-heading">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2
            id="verification-heading"
            className="text-base font-semibold text-cryptoNight dark:text-white"
          >
            Verification methods
          </h2>
          <p className="mt-1 text-xs text-gray-20 dark:text-gray-40">
            Enable at least one method to approve sensitive transactions.
          </p>
        </div>
        {isLoading ? (
          <span className="text-xs text-gray-30">Loading…</span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
        <SecurityMethodRow
          icon={<Mail className="h-5 w-5" />}
          title="Email verification"
          description="Receive one-time codes at your account email."
          checked={settings.emailOtpEnabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onOtpChange("email", enabled)}
        />
        <SecurityMethodRow
          icon={<MessageSquareText className="h-5 w-5" />}
          title="SMS verification"
          description="Receive one-time codes on your verified phone number."
          checked={settings.smsOtpEnabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onOtpChange("sms", enabled)}
        />
        <SecurityMethodRow
          icon={<Smartphone className="h-5 w-5" />}
          title="Google Authenticator"
          description="Use rotating codes from your authenticator app."
          checked={settings.totpEnabled}
          disabled={disabled}
          onCheckedChange={onTotpChange}
        />
        <SecurityMethodRow
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Biometric confirmation"
          description="Require a supported biometric check for sensitive actions."
          checked={settings.biometricsEnabled}
          disabled={disabled}
          onCheckedChange={onBiometricsChange}
        />
      </div>
    </section>
  );
}

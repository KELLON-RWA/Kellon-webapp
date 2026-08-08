import { ChevronRight, KeyRound, TabletSmartphone, Users } from "lucide-react";
import type { IntegrationModal } from "./security-types";

const INTEGRATIONS = [
  {
    id: "stellar" as const,
    icon: KeyRound,
    title: "Stellar Key Recovery",
    description: "Back up and recover your Stellar wallet key.",
  },
  {
    id: "devices" as const,
    icon: TabletSmartphone,
    title: "Trusted Devices",
    description: "Review devices with access to your Kellon account.",
  },
  {
    id: "social" as const,
    icon: Users,
    title: "Social Recovery",
    description: "Manage guardians who can help recover your account.",
  },
];

interface RecoveryAccessSectionProps {
  onSelect: (integration: Exclude<IntegrationModal, null>) => void;
}

export default function RecoveryAccessSection({
  onSelect,
}: RecoveryAccessSectionProps) {
  return (
    <section className="mt-8" aria-labelledby="recovery-heading">
      <h2
        id="recovery-heading"
        className="text-base font-semibold text-cryptoNight dark:text-white"
      >
        Recovery &amp; access
      </h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          return (
            <button
              key={integration.id}
              type="button"
              onClick={() => onSelect(integration.id)}
              className="flex w-full cursor-pointer items-center gap-4 border-b border-black/5 px-4 py-4 text-left transition hover:bg-gray-95 last:border-b-0 dark:border-white/10 dark:hover:bg-secondary-60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                  {integration.title}
                </p>
                <p className="mt-1 text-xs text-gray-20 dark:text-gray-40">
                  {integration.description}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-30" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

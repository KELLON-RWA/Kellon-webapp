import { CheckCircle2 } from "lucide-react";

export default function SecurityTips() {
  return (
    <section
      className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/20 dark:bg-amber-500/10"
      aria-labelledby="tips-heading"
    >
      <h2
        id="tips-heading"
        className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200"
      >
        <CheckCircle2 className="h-4 w-4" /> Security tips
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-amber-900/80 dark:text-amber-100/75">
        <li>
          Enable two independent verification methods in case one becomes
          unavailable.
        </li>
        <li>
          Never share OTPs, authenticator codes, recovery keys, or wallet
          credentials.
        </li>
        <li>
          Review trusted devices regularly and remove anything you do not
          recognize.
        </li>
        <li>
          Keep recovery information offline and verify every withdrawal
          destination.
        </li>
      </ul>
    </section>
  );
}

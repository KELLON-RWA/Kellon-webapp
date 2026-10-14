import { ArrowRightLeft, Bell } from "lucide-react";

export default function NotificationCategoryIcon({
  category,
  className = "h-5 w-5",
}: {
  category: string;
  className?: string;
}) {
  const Icon = category === "Transactions" ? ArrowRightLeft : Bell;
  return <Icon className={className} aria-hidden="true" />;
}

import { ArrowUp, ArrowUpRight, MoreHorizontal, Plus } from "lucide-react";
import QuickAction from "@/components/wallet/dashboard/QuickAction";

interface QuickActionsPanelProps {
  onAddFunds: () => void;
  onSend: () => void;
  onWithdraw: () => void;
  onMore: () => void;
}

export default function QuickActionsPanel({
  onAddFunds,
  onSend,
  onWithdraw,
  onMore,
}: QuickActionsPanelProps) {
  return (
    <section className="order-2 flex w-full items-start justify-start gap-2 xs:gap-3 md:grid md:grid-cols-4 md:content-start md:gap-3 min-[1024px]:order-none min-[1024px]:col-span-full min-[1024px]:!grid-cols-4 min-[1024px]:!gap-1.5 min-[1024px]:!border-0 min-[1024px]:!bg-white/80 min-[1024px]:!p-2 min-[1024px]:!shadow-none min-[1024px]:dark:!bg-secondary-50 min-[1280px]:!grid-cols-2 lg:rounded-xl lg:border lg:border-white/70 lg:bg-white/60 lg:p-3 lg:shadow-sm lg:shadow-primary-90/20 lg:backdrop-blur-xl lg:dark:border-white/10 lg:dark:bg-transparent lg:dark:shadow-none">
      <QuickAction
        icon={<Plus size={18} />}
        label="Add Funds"
        onClick={onAddFunds}
      />
      <QuickAction
        icon={<ArrowUpRight size={18} />}
        label="Send"
        onClick={onSend}
      />
      <QuickAction
        icon={<ArrowUp size={18} />}
        label="Withdraw"
        onClick={onWithdraw}
      />
      <QuickAction
        icon={<MoreHorizontal size={18} />}
        label="More"
        onClick={onMore}
      />
    </section>
  );
}

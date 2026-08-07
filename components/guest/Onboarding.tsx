"use client";

import { useState, FC } from "react";
import { ArrowRight } from "lucide-react";
import { Icons } from "@/components/Icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import AuthHero from "@/components/auth/AuthHero";

const SLIDES = [
  {
    title: "Finance Without Borders",
    desc: "Experience a financial system as global as you are. Manage and move USDC with instant settlements and zero friction.",
  },
  {
    title: "Send via Email",
    desc: "The end of wallet-address anxiety. Send funds to any email instantly—we'll secure it in a unique Magic Wallet.",
  },
  {
    title: "Fast Payouts",
    desc: "Get paid like a local, anywhere. Issue smart invoices and receive instant settlements via global rails.",
  },
];

interface WebOnboardingProps {
  onComplete: () => void;
}

const WebOnboarding: FC<WebOnboardingProps> = ({ onComplete }) => {
  const [current, setCurrent] = useState(0);

  const handleNext = () => {
    if (current === SLIDES.length - 1) {
      onComplete();
    } else {
      setCurrent((prev) => prev + 1);
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      {/* --- LEFT SIDE: Brand Identity (Identical to Continue.tsx) --- */}
      <AuthHero />

      {/* --- RIGHT SIDE / MOBILE DRAWER --- */}
      <div className="relative flex flex-1 items-end lg:items-center justify-center overflow-hidden">
        {/* Mobile Header Logo */}
        <div className="absolute top-12 left-0 right-0 flex justify-center lg:hidden z-10">
          <div className="flex items-center gap-3">
            <Icons.Logo className="h-10 w-10" />
            <span className="text-2xl font-bold text-cryptoNight dark:text-white">
              Kellon
            </span>
          </div>
        </div>

        {/* Content Card / Drawer */}
        <div className="relative z-20 w-full lg:max-w-[500px]">
          <Card
            className={cn(
              "overflow-hidden border-0 shadow-none lg:border transition-all duration-500",
              // Desktop: Cloned from Continue.tsx card
              "lg:rounded-[40px] lg:bg-white/90 lg:dark:bg-secondary-60 lg:shadow-[0_20px_80px_rgba(0,0,0,0.06)] lg:backdrop-blur-xl lg:border bg:border-white/60 dark:border-secondary-60 lg:max-w-md  lg:mx-auto",
              // Mobile Drawer Styling:
              "rounded-t-[40px] bg-white dark:bg-secondary-60/50 shadow-[0_-15px_50px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-full duration-700 ease-out",
            )}
          >
            <CardContent className="p-6 sm:p-8 md:p-12 xs:max-w-md xs:mx-auto">
              {/* Progress Dots */}
              <div
                className="mb-10 flex justify-center gap-2"
                role="group"
                aria-label={`Onboarding step ${current + 1} of ${SLIDES.length}`}
              >
                {SLIDES.map((_, i) => (
                  <div
                    key={i}
                    aria-current={i === current ? "step" : undefined}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === current
                        ? "w-8 bg-primary-50"
                        : "w-2 bg-gray-100 dark:bg-gray-200",
                    )}
                  />
                ))}
              </div>

              {/* Dynamic Text Content */}
              <div
                key={current}
                aria-live="polite"
                className="mb-12 text-center space-y-4 animate-in fade-in slide-in-from-right-6 duration-500 "
              >
                <h1 className="font-bold text-4xl text-cryptoNight dark:text-white max-w-[340px] mx-auto md:max-w-none md:text-5xl">
                  {SLIDES[current].title}
                </h1>
                <p className="mx-auto max-w-[340px] text-[15px] leading-relaxed text-gray-400 dark:text-gray-100">
                  {SLIDES[current].desc}
                </p>
              </div>

              {/* CTA Button: Cloned from Continue.tsx */}
              <div className="space-y-6">
                <Button
                  type="button"
                  onClick={handleNext}
                  size="full"
                  variant="secondary"
                  className="h-[60px] rounded-2xl border hover:bg-secondary-70 dark:bg-white2 text-white dark:hover:bg-gray-200 dark:text-2xl dark:text-gray-700 shadow-md active:scale-[0.98] transition-all"
                >
                  <span className="flex items-center justify-center gap-3 text-[15px] font-semibold">
                    {current === SLIDES.length - 1 ? "Get Started" : "Continue"}
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Button>

                <div className="flex flex-col items-center gap-4">
                  <p className="text-center text-xs text-gray-400 dark:text-gray-400">
                    Step {current + 1} of {SLIDES.length}
                  </p>

                  <button
                    type="button"
                    onClick={onComplete}
                    className="text-xs font-semibold text-gray-400 hover:text-cryptoNight dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Skip exploration
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WebOnboarding;

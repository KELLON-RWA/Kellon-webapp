"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  Nfc,
  Globe2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "@/types/db";

interface VirtualCardsPageProps {
  profile: User;
}

const benefits = [
  {
    title: "Global Spending",
    description: "Use online and in-store anywhere Visa or Mastercard is accepted.",
    icon: Globe2,
    iconClassName: "text-primary-60",
  },
  {
    title: "Instant Crypto Funding",
    description: "Fund seamlessly from your USDC or USDT balance.",
    icon: Zap,
    iconClassName: "text-amber-400",
  },
  {
    title: "Bank-Grade Security",
    description: "Freeze instantly in one tap. 3D Secure supported.",
    icon: ShieldCheck,
    iconClassName: "text-emerald-400",
  },
];

export default function VirtualCardsPage({ profile }: VirtualCardsPageProps) {
  const cardholderName = (
    profile.name?.trim() || profile.email?.split("@")[0] || "Kellon Member"
  ).toUpperCase();

  return (
    <div className="container mx-auto w-full max-w-7xl px-4 pb-32 pt-4 md:px-6 md:pb-12 md:pt-28">
      <header className="relative mb-8 flex items-center justify-center md:mb-10 md:justify-between">
        <Link
          href="/"
          aria-label="Back to wallet"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-gray-95 text-gray-700 transition hover:bg-gray-90 dark:bg-secondary-50 dark:text-gray-200 dark:hover:bg-secondary-60 md:static"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="text-center md:text-left">
          <p className="hidden text-xs font-bold uppercase tracking-[0.2em] text-primary-60 md:block">
            Kellon Cards
          </p>
          <h1 className="text-xl font-bold text-black dark:text-white md:mt-1 md:text-3xl">
            Virtual Cards
          </h1>
        </div>
        <div className="hidden w-10 md:block" />
      </header>

      <section className="grid items-center gap-10 rounded-[28px] border border-black/5 bg-white/65 p-5 shadow-sm shadow-primary-90/10 backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/45 dark:shadow-none md:grid-cols-2 md:gap-12 md:p-10 lg:p-14">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="relative flex aspect-[1.586/1] flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#162c76] via-[#493ab3] to-[#5143dc] p-5 text-white shadow-[0_24px_45px_rgba(49,38,160,0.3)] md:p-8">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-60/25 blur-3xl" />
            <div className="absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-[#45a4f5]/20 blur-3xl" />

            <div className="relative flex items-center justify-between">
              <span className="text-[clamp(10px,3.5vw,14px)] font-bold tracking-[0.08em]">
                KELLON
              </span>
              <span className="rounded-full bg-white/15 px-2 py-1 text-[clamp(6px,2vw,10px)] font-bold tracking-wide backdrop-blur-sm sm:px-3">
                COMING SOON
              </span>
            </div>

            <div className="relative mt-auto flex items-center gap-4">
              <div className="grid h-8 w-10 grid-cols-2 gap-px overflow-hidden rounded-md bg-amber-300 p-1 shadow-inner shadow-amber-100/70 sm:h-9 sm:w-12">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span key={index} className="rounded-sm bg-amber-500/80" />
                ))}
              </div>
              <Nfc className="h-6 w-6 rotate-90 text-white/90 sm:h-8 sm:w-8" />
            </div>

            <p className="relative mt-auto whitespace-nowrap text-[clamp(12px,4.5vw,24px)] font-semibold tracking-[0.13em]">
              •••• •••• •••• 8820
            </p>

            <div className="relative mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[6px] font-medium uppercase tracking-wide text-white/60 sm:text-[7px] xl:text-[8px]">
                  Cardholder
                </p>
                <p className="whitespace-nowrap text-[8px] font-bold tracking-[0.025em] sm:text-[9px] lg:text-[10px] xl:text-sm">
                  {cardholderName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-[6px] font-medium uppercase tracking-wide text-white/60 sm:text-[7px] xl:text-[8px]">
                  Currency
                </p>
                <p className="text-[8px] font-bold sm:text-[9px] lg:text-[10px] xl:text-sm">USD / USDC</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-lg text-center md:mx-0 md:text-left">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-60">
            Coming soon
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-black dark:text-white md:text-4xl">
            Virtual Dollar Cards
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400 md:mx-0 md:text-base">
            Spend your crypto worldwide wherever Visa and Mastercard are accepted.
            Instant top-ups come directly from your wallet balance.
          </p>
          <button
            type="button"
            onClick={() => toast.success("We’ll let you know when Virtual Cards go live.")}
            className="mt-7 inline-flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-50 to-primary-70 px-6 text-sm font-bold text-white shadow-lg shadow-primary-60/20 transition hover:brightness-110 active:scale-[0.99] md:w-auto"
          >
            <BellRing className="h-5 w-5" />
            Get Notified When Live
          </button>
        </div>
      </section>

      <section className="mt-8 md:mt-10">
        <div className="mb-4 hidden items-center justify-between md:mb-5 md:flex">
          <h2 className="text-lg font-bold text-black dark:text-white">Built for everyday spending</h2>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Virtual dollar card</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {benefits.map(({ title, description, icon: Icon, iconClassName }) => (
            <article
              key={title}
              className="rounded-3xl border border-black/5 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-secondary-50"
            >
              <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-95 dark:bg-secondary-60 ${iconClassName}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-black dark:text-white">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

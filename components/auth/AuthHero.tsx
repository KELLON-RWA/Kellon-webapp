"use client"

import { FC } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

const AuthHero: FC = () => {
  return (
    <div className="relative hidden lg:flex w-1/2 overflow-hidden border-r border-white/10 bg-gradient-to-br from-primary-50 via-primary-0 to-secondary-50 p-20 text-white">
      {/* Ambient Glow */}
      <div className="absolute left-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-pink-400/20 blur-3xl" />

      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl" />

      {/* Noise Texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('/noise.png')]" />

      {/* GLOBAL DARK OVERLAY */}
      <div className="absolute inset-0 bg-black/20 z-[1]" />

      {/* TEXT FOCUS OVERLAY */}
      <div className="absolute inset-y-0 left-0 w-[60%] bg-gradient-to-r from-black/55 via-black/25 to-transparent z-[2]" />

      {/* BOTTOM FADE */}
      <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/30 to-transparent z-[2]" />

      {/* CONTENT */}
      <div className="relative z-30 flex h-full flex-col">
        {/* HERO */}
        <div className="max-w-[420px] space-y-8 animate-in fade-in slide-in-from-top-6 duration-700">
          <p className="text-6xl font-bold leading-[1] tracking-tight drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
            Your money. <br />
            <span className="font-extrabold text-pink-300">One app.</span>
          </p>

          <p className="max-w-[360px] text-[17px] leading-relaxed text-white/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]">
            Send money, manage assets, and invest globally with a secure modern
            finance app.
          </p>
        </div>

        {/* BOTTOM TEXT */}
        <div className="mt-auto z-30">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/55">
            Secure • Simple • Global
          </p>
        </div>
      </div>

      {/* DEVICE MOCKUP */}
      <div
        className={cn(
          " absolute z-10 animate-in fade-in slide-in-from-right-12 duration-1000delay-300",

          "right-[-22%] bottom-[-16%] w-[680px] h-[680px]",
          "vh-xs:right-[-28%]  vh-xs:bottom-[-22%] vh-xs:w-[560px] vh-xs:h-[560px]",

          "vh-sm:right-[-22%] vh-sm:bottom-[-14%]  vh-sm:w-[620px]  vh-sm:h-[620px]",

          " vh-md:right-[-18%] vh-md:bottom-[-10%]  vh-md:w-[720px]  vh-md:h-[720px]",

          "  vh-lg:right-[-14%] vh-lg:bottom-[-6%]  vh-lg:w-[820px] vh-lg:h-[820px]  ",
        )}
      >
        <Image
          src="https://res.cloudinary.com/djd1gxvwm/image/upload/v1778092378/Mockuuups_Free_mockup_of_female_hand_holding_iPhone_14_Pro_qjbyhg.png"
          alt="Kellon App"
          fill
          priority
          className="object-contain object-right-bottom drop-shadow-[0_40px_55px_rgba(0,0,0,0.38)]"
        />
      </div>

      {/* FULL SECTION IMAGE OVERLAY */}
      <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/45 via-black/15 to-black/35 pointer-events-none" />
    </div>
  )
}

export default AuthHero

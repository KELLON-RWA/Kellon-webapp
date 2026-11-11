"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProviderLogoProps {
  name: string;
  logo?: string | null;
  className?: string;
  imageClassName?: string;
  size?: number;
}

export function isPaycrest(name?: string | null): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase().replace(/[\s_-]+/g, "");
  return normalized.includes("paycrest");
}

export function PaycrestEmblem({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 26 28"
      fill="none"
      className={cn("h-5 w-5", className)}
      aria-label="Paycrest Logo"
    >
      <path
        d="M 12.88 0 C 13.81 0 14.658 0.478 16.353 1.434 L 22.286 4.779 C 23.981 5.735 24.829 6.213 25.295 7 C 25.76 7.787 25.76 8.743 25.76 10.655 L 25.76 17.345 C 25.76 19.257 25.76 20.213 25.295 21 C 24.829 21.787 23.981 22.265 22.286 23.22 L 16.353 26.566 C 14.659 27.522 13.812 28 12.88 28 C 11.95 28 11.101 27.522 9.406 26.566 L 3.474 23.221 C 3.139 23.037 2.925 22.692 2.907 22.311 C 2.889 21.929 3.071 21.566 3.387 21.352 C 5.644 19.776 7.96 18.287 10.331 16.888 C 10.644 16.646 10.745 16.218 10.574 15.861 C 10.491 15.687 10.351 15.546 10.178 15.46 C 10.003 15.373 9.804 15.346 9.612 15.383 C 6.981 16.322 4.387 17.362 1.836 18.501 C 0.966 18.889 0 18.297 0 17.345 L 0 10.655 C 0 8.743 0 7.787 0.466 7 C 0.931 6.213 1.779 5.735 3.474 4.78 L 9.406 1.434 C 11.101 0.478 11.95 0 12.88 0 Z M 18.45 5.321 C 18.126 5.341 17.941 5.829 17.572 6.804 L 17.102 8.046 C 17.028 8.241 16.992 8.339 16.92 8.411 L 16.904 8.426 C 16.83 8.496 16.729 8.531 16.528 8.603 L 15.248 9.06 C 14.243 9.418 13.74 9.597 13.721 9.911 C 13.72 9.931 13.72 9.95 13.721 9.97 C 13.741 10.284 14.243 10.463 15.248 10.821 L 16.528 11.277 C 16.729 11.349 16.83 11.386 16.904 11.455 L 16.92 11.47 C 16.991 11.542 17.028 11.64 17.102 11.835 L 17.572 13.077 C 17.942 14.052 18.126 14.54 18.449 14.56 C 18.469 14.561 18.489 14.561 18.509 14.56 C 18.833 14.54 19.019 14.052 19.388 13.077 L 19.858 11.835 C 19.931 11.64 19.968 11.542 20.04 11.47 L 20.055 11.455 C 20.129 11.385 20.23 11.349 20.432 11.277 L 21.712 10.821 C 22.717 10.463 23.22 10.284 23.239 9.97 C 23.24 9.95 23.24 9.931 23.239 9.911 C 23.219 9.597 22.717 9.418 21.712 9.06 L 20.432 8.603 C 20.231 8.531 20.129 8.495 20.055 8.426 L 20.04 8.411 C 19.968 8.339 19.931 8.241 19.857 8.046 L 19.387 6.804 C 19.018 5.828 18.833 5.34 18.51 5.321 C 18.49 5.32 18.47 5.32 18.45 5.321 Z"
        fill="#0F6AEB"
      />
    </svg>
  );
}

export function ProviderLogo({
  name,
  logo,
  className,
  imageClassName,
  size = 40,
}: ProviderLogoProps) {
  const [hasError, setHasError] = useState(false);
  const paycrest = isPaycrest(name);

  // If it's Paycrest, ensure we have an effective logo URL or emblem
  const effectiveSrc = logo || (paycrest ? "/paycrest-logo.svg" : null);

  if (hasError || !effectiveSrc) {
    if (paycrest) {
      return (
        <div className={cn("relative flex h-full w-full items-center justify-center", className)}>
          <PaycrestEmblem className="h-6 w-6" />
        </div>
      );
    }
    return (
      <div className={cn("relative flex h-full w-full items-center justify-center", className)}>
        <Globe className="h-5 w-5 text-primary-60" />
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <Image
        fill
        src={effectiveSrc}
        alt={name}
        className={cn("object-contain p-1.5", imageClassName)}
        sizes={`${size}px`}
        onError={() => setHasError(true)}
      />
    </div>
  );
}

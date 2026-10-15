"use client";

import { useState } from "react";

export default function CompanyNewsThumbnail({ src }: { src?: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!src || failedSrc === src) return null;
  return (
    // Publisher image is optional and externally hosted; hide it if unavailable.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className="h-14 w-20 shrink-0 rounded-lg object-cover sm:h-16 sm:w-24"
    />
  );
}

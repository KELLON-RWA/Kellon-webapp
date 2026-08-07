import Continue from "@/components/auth/Continue";
import { FC } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Continue",
  description:
    "Continue to Kellon and access your wallet for borderless payments and global investments.",
  robots: { index: false, follow: false, nocache: true },
};

const page: FC = ({}) => {
  return (
    <main id="main-content" tabIndex={-1}>
      <Continue />
    </main>
  );
};

export default page;

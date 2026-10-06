"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PageItem = number | "ellipsis";

function getPaginationItems(
  currentPage: number,
  pageCount: number,
): PageItem[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, "ellipsis", pageCount];
  if (currentPage === 3) return [1, 2, 3, 4, "ellipsis", pageCount];
  if (currentPage >= pageCount - 1) {
    return [1, "ellipsis", pageCount - 1, pageCount];
  }
  if (currentPage === pageCount - 2) {
    return [
      1,
      "ellipsis",
      pageCount - 3,
      pageCount - 2,
      pageCount - 1,
      pageCount,
    ];
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    pageCount,
  ];
}

interface PaginationProps {
  ariaLabel: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageCount: number;
  className?: string;
}

export default function Pagination({
  ariaLabel,
  currentPage,
  onPageChange,
  pageCount,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex items-center justify-center px-1 py-4 sm:justify-between",
        className,
      )}
    >
      <span className="hidden text-xs text-gray-500 dark:text-gray-40 sm:block">
        Page {currentPage} of {pageCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-gray-80 text-gray-500 transition-colors hover:border-primary-70 hover:text-primary-60 disabled:cursor-default disabled:opacity-40 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-80"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {getPaginationItems(currentPage, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="grid h-8 w-5 shrink-0 place-items-center text-xs text-gray-500 dark:text-gray-40"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === currentPage ? "page" : undefined}
              className={cn(
                "grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-xs font-semibold transition-colors",
                item === currentPage
                  ? "bg-primary-70 text-white"
                  : "border border-gray-80 text-gray-500 hover:border-primary-70 hover:text-primary-60 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-80",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage === pageCount}
          aria-label="Next page"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-gray-80 text-gray-500 transition-colors hover:border-primary-70 hover:text-primary-60 disabled:cursor-default disabled:opacity-40 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-80"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

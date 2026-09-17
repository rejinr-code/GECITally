"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
      <h2 className="text-lg font-semibold">Could not load this page</h2>
      <p className="mt-2 text-sm">{error.message || "An unexpected error occurred."}</p>
      <Button className="mt-4" type="button" variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

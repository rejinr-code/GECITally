"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintReportButton({ title }: { title?: string }) {
  return (
    <Button
      size="lg"
      onClick={() => {
        const previous = document.title;
        document.documentElement.classList.add("print-document");
        document.title = title ?? "";
        const restore = () => {
          document.title = previous;
          document.documentElement.classList.remove("print-document");
          window.removeEventListener("afterprint", restore);
        };
        window.addEventListener("afterprint", restore);
        window.print();
        window.setTimeout(restore, 500);
      }}
    >
      <Printer />
      Print / Save as PDF
    </Button>
  );
}

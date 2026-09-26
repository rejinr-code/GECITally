"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <Button
      size="lg"
      onClick={() => {
        const previous = document.title;
        document.title = "GECI-College-Union-Result-Declaration";
        window.print();
        document.title = previous;
      }}
    >
      <Printer />
      Print / Save as PDF
    </Button>
  );
}

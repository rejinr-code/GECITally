"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintDummyBallotsButton() {
  return (
    <Button
      size="lg"
      onClick={() => {
        const previous = document.title;
        document.title = "GECI-Dummy-Ballots";
        window.print();
        document.title = previous;
      }}
    >
      <Printer />
      Print dummy ballots
    </Button>
  );
}

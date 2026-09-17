"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deletePanel, savePanel } from "@/lib/actions/admin";
import type { Panel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";

export function PanelManager({
  electionId,
  panels,
}: {
  electionId: string | null;
  panels: Panel[];
}) {
  const { isSubmitting, run } = useAntiDuplicate();

  if (!electionId) {
    return <p className="text-sm text-muted-foreground">Save election metadata first.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Panels</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure panels once, then select one when adding or editing a candidate. Leave a
          candidate as Independent if they are not on a panel.
        </p>
        <form
          className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void run(async () => {
              const result = await savePanel(new FormData(form));
              if (result.error) toast.error(result.error);
              else {
                toast.success("Panel saved.");
                form.reset();
              }
            });
          }}
        >
          <input type="hidden" name="election_id" value={electionId} />
          <div className="space-y-2">
            <Label htmlFor="panel-name">Panel name</Label>
            <Input id="panel-name" name="name" placeholder="Unity Panel" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="panel-order">Order</Label>
            <Input
              id="panel-order"
              name="display_order"
              type="number"
              defaultValue={panels.length + 1}
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Add panel
          </Button>
        </form>
        {panels.length ? (
          <ul className="space-y-2">
            {panels.map((panel) => (
              <PanelRow key={panel.id} panel={panel} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No panels yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PanelRow({ panel }: { panel: Panel }) {
  const { isSubmitting, run } = useAntiDuplicate();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-lg border bg-white px-3 py-3">
        <form
          className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void run(async () => {
              const result = await savePanel(new FormData(form));
              if (result.error) toast.error(result.error);
              else {
                toast.success("Panel updated.");
                setEditing(false);
              }
            });
          }}
        >
          <input type="hidden" name="id" value={panel.id} />
          <input type="hidden" name="election_id" value={panel.election_id} />
          <div className="space-y-2">
            <Label htmlFor={`panel-name-${panel.id}`}>Panel name</Label>
            <Input id={`panel-name-${panel.id}`} name="name" defaultValue={panel.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`panel-order-${panel.id}`}>Order</Label>
            <Input
              id={`panel-order-${panel.id}`}
              name="display_order"
              type="number"
              defaultValue={panel.display_order}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
      <p className="font-medium">{panel.name}</p>
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!window.confirm(`Delete ${panel.name}? Candidates stay, unassigned.`)) {
              return;
            }
            void deletePanel(panel.id).then((result) => {
              if (result.error) toast.error(result.error);
              else toast.success("Panel deleted.");
            });
          }}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

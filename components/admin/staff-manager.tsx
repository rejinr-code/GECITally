"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  createStaffAccount,
  deleteStaffAccount,
  updateProfileRole,
  updateStaffAssignments,
} from "@/lib/actions/admin";
import type { Post, Profile, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import { postSerial, roleLabel } from "@/lib/utils";

type StaffRow = Profile & { assigned_post_ids: string[] };

export function StaffManager({
  posts,
  people,
}: {
  posts: Post[];
  people: StaffRow[];
}) {
  const staff = people.filter((person) => person.role === "staff");
  const supervisors = people.filter((person) => person.role === "supervisor");
  const admins = people.filter((person) => person.role === "admin");
  const displays = people.filter((person) => person.role === "display");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateAccountForm posts={posts} />
        </CardContent>
      </Card>

      <RoleList title="Returning Officer" people={supervisors} />
      <RoleList title="Public results display" people={displays} />
      <RoleList title="Admins" people={admins} />
      <StaffList staff={staff} posts={posts} />
    </div>
  );
}

function CreateAccountForm({ posts }: { posts: Post[] }) {
  const { isSubmitting, run } = useAntiDuplicate();
  const [role, setRole] = useState<UserRole>("staff");

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void run(async () => {
          const result = await createStaffAccount(new FormData(form));
          if (result.error) toast.error(result.error);
          else {
            toast.success("Account created.");
            form.reset();
            setRole("staff");
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          value={role}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          onChange={(event) => setRole(event.target.value as UserRole)}
        >
          <option value="staff">Counting Supervisor</option>
          <option value="supervisor">Returning Officer</option>
          <option value="display">Public results display</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {role === "staff" && (
        <div className="space-y-2 md:col-span-2">
          <Label>Assign posts</Label>
          <p className="text-xs text-muted-foreground">
            Counting Supervisors can enter votes only for the posts you assign here.
          </p>
          <div className="flex flex-wrap gap-3">
            {posts.map((post, index) => (
              <label key={post.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="post_ids" value={post.id} />
                {postSerial(post, index)}. {post.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="admin_password">Your admin password</Label>
        <Input id="admin_password" name="admin_password" type="password" autoComplete="off" required />
        <p className="text-xs text-muted-foreground">Required to create accounts, including other admins.</p>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : null}
        Create account
      </Button>
    </form>
  );
}

function RoleList({ title, people }: { title: string; people: Profile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">None assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {people.map((person) => (
              <li key={person.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="font-medium">{person.full_name}</span>
                <Badge variant="secondary">{roleLabel(person.role)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StaffList({ staff, posts }: { staff: StaffRow[]; posts: Post[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Counting Supervisors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {staff.length === 0 && <p className="text-sm text-muted-foreground">No Counting Supervisor accounts yet.</p>}
        {staff.map((person) => (
          <StaffRowCard key={person.id} person={person} posts={posts} />
        ))}
      </CardContent>
    </Card>
  );
}

function StaffRowCard({ person, posts }: { person: StaffRow; posts: Post[] }) {
  const [selected, setSelected] = useState<string[]>(person.assigned_post_ids);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const { isSubmitting, run } = useAntiDuplicate();

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{person.full_name}</p>
        <select
          className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          value={pendingRole ?? person.role}
          onChange={(event) => setPendingRole(event.target.value as UserRole)}
        >
          <option value="staff">Counting Supervisor</option>
          <option value="supervisor">Returning Officer</option>
          <option value="display">Public results</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        {posts.map((post, index) => (
          <label key={post.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(post.id)}
              onChange={(event) => {
                setSelected((current) =>
                  event.target.checked
                    ? [...current, post.id]
                    : current.filter((id) => id !== post.id),
                );
              }}
            />
            {postSerial(post, index)}. {post.name}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          type="button"
          disabled={isSubmitting}
          onClick={() => setAssignOpen(true)}
        >
          {isSubmitting ? <Spinner /> : null}
          Save assignments
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>
      {assignOpen ? (
        <PasswordDialog
          title={`Save assignments for ${person.full_name}?`}
          detail="This controls which posts they can count. Enter your admin password to confirm."
          confirmLabel="Save assignments"
          busy={isSubmitting}
          onCancel={() => setAssignOpen(false)}
          onConfirm={(password) => {
            void run(async () => {
              const result = await updateStaffAssignments(person.id, selected, password);
              if (result.error) {
                toast.error(result.error);
                return false;
              }
              toast.success("Assignments saved.");
              setAssignOpen(false);
              return true;
            });
          }}
        />
      ) : null}
      {pendingRole && pendingRole !== person.role ? (
        <PasswordDialog
          title={`Change ${person.full_name} to ${roleLabel(pendingRole)}?`}
          detail="Enter your admin password to confirm this role change."
          confirmLabel="Update role"
          busy={isSubmitting}
          onCancel={() => setPendingRole(null)}
          onConfirm={(password) => {
            void run(async () => {
              const result = await updateProfileRole(person.id, pendingRole, password);
              if (result.error) {
                toast.error(result.error);
                return false;
              }
              toast.success("Role updated.");
              setPendingRole(null);
              return true;
            });
          }}
        />
      ) : null}
      {deleteOpen ? (
        <PasswordDialog
          title={`Delete ${person.full_name}?`}
          detail="They will no longer be able to sign in. Enter your admin password to confirm."
          confirmLabel="Delete"
          destructive
          busy={isSubmitting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={(password) => {
            void run(async () => {
              const result = await deleteStaffAccount(person.id, password);
              if (result.error) {
                toast.error(result.error);
                return false;
              }
              toast.success("Counting Supervisor deleted.");
              setDeleteOpen(false);
              return true;
            });
          }}
        />
      ) : null}
    </div>
  );
}

function PasswordDialog({
  title,
  detail,
  confirmLabel,
  destructive = false,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(password);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="people-admin-password">Admin password</Label>
            <Input
              id="people-admin-password"
              type="password"
              autoComplete="off"
              value={password}
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy || !password.trim()}>
              {busy ? <Spinner /> : null}
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

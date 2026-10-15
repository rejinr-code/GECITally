"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { createStaffAccount, deleteAccount, updateAccount } from "@/lib/actions/admin";
import type { Post, Profile, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import { postSerial, roleLabel } from "@/lib/utils";

export type PersonRow = Profile & { assigned_post_ids: string[]; email?: string | null };

export function StaffManager({
  posts,
  people,
  currentUserId,
}: {
  posts: Post[];
  people: PersonRow[];
  currentUserId: string;
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

      <RoleList title="Returning Officer" people={supervisors} posts={posts} currentUserId={currentUserId} />
      <RoleList title="Public results display" people={displays} posts={posts} currentUserId={currentUserId} />
      <RoleList title="Admins" people={admins} posts={posts} currentUserId={currentUserId} />
      <RoleList title="Counting Supervisors" people={staff} posts={posts} currentUserId={currentUserId} showAssignments />
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
          <RoleOptions />
        </select>
      </div>
      {role === "staff" && (
        <div className="space-y-2 md:col-span-2">
          <Label>Assign posts</Label>
          <p className="text-xs text-muted-foreground">
            Counting Supervisors can enter votes only for the posts you assign here.
          </p>
          <PostCheckboxes posts={posts} />
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

function RoleList({
  title,
  people,
  posts,
  currentUserId,
  showAssignments = false,
}: {
  title: string;
  people: PersonRow[];
  posts: Post[];
  currentUserId: string;
  showAssignments?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">None assigned yet.</p>
        ) : (
          people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              posts={posts}
              currentUserId={currentUserId}
              showAssignments={showAssignments}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PersonCard({
  person,
  posts,
  currentUserId,
  showAssignments,
}: {
  person: PersonRow;
  posts: Post[];
  currentUserId: string;
  showAssignments: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { isSubmitting, run } = useAntiDuplicate();
  const isSelf = person.id === currentUserId;
  const assigned = posts.filter((post) => person.assigned_post_ids.includes(post.id));

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {person.full_name}
            {isSelf ? (
              <Badge variant="secondary" className="ml-2 align-middle">
                You
              </Badge>
            ) : null}
          </p>
          {person.email ? <p className="text-xs text-muted-foreground">{person.email}</p> : null}
          {showAssignments ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {assigned.length ? `Assigned: ${assigned.map((post) => post.name).join(", ")}` : "No posts assigned."}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{roleLabel(person.role)}</Badge>
          <Button size="sm" type="button" variant="outline" disabled={isSubmitting} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={isSubmitting || isSelf}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>
      {editing ? (
        <EditPersonDialog
          person={person}
          posts={posts}
          isSelf={isSelf}
          busy={isSubmitting}
          onCancel={() => setEditing(false)}
          onSave={(payload, password) => {
            void run(async () => {
              const result = await updateAccount(person.id, payload, password);
              if (result.error) {
                toast.error(result.error);
                return false;
              }
              toast.success(result.passwordChanged ? "Password updated." : "Account updated.");
              setEditing(false);
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
              const result = await deleteAccount(person.id, password);
              if (result.error) {
                toast.error(result.error);
                return false;
              }
              toast.success("Account deleted.");
              setDeleteOpen(false);
              return true;
            });
          }}
        />
      ) : null}
    </div>
  );
}

function EditPersonDialog({
  person,
  posts,
  isSelf,
  busy,
  onCancel,
  onSave,
}: {
  person: PersonRow;
  posts: Post[];
  isSelf: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: (
    payload: { full_name: string; role: UserRole; password?: string; postIds?: string[] },
    adminPassword: string,
  ) => void;
}) {
  const nameId = useId();
  const roleId = useId();
  const passwordId = useId();
  const adminPasswordId = useId();
  const [fullName, setFullName] = useState(person.full_name);
  const [role, setRole] = useState<UserRole>(person.role);
  const [postIds, setPostIds] = useState<string[]>(person.assigned_post_ids);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">Edit {person.full_name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update this account, then confirm with your admin password.</p>
        <form
          className="mt-4 space-y-3"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const nextPassword = String(form.get("account_new_password") ?? "");
            const confirmPassword = String(form.get("admin_confirm_password") ?? "");
            onSave(
              {
                full_name: fullName,
                role,
                password: nextPassword || undefined,
                postIds: role === "staff" ? postIds : [],
              },
              confirmPassword,
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={nameId}>Full name</Label>
            <Input id={nameId} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={roleId}>Role</Label>
            <select
              id={roleId}
              value={role}
              disabled={isSelf}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-60"
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              <RoleOptions />
            </select>
            {isSelf ? <p className="text-xs text-muted-foreground">You cannot change your own role.</p> : null}
          </div>
          {role === "staff" ? (
            <div className="space-y-2">
              <Label>Assign posts</Label>
              <PostCheckboxes
                posts={posts}
                selected={postIds}
                onChange={setPostIds}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={passwordId}>New password for this user (optional)</Label>
            <Input
              id={passwordId}
              name="account_new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              defaultValue=""
            />
            <p className="text-xs text-muted-foreground">Leave blank to keep their current password. At least 8 characters if you set one.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={adminPasswordId}>Your admin password</Label>
            <Input
              id={adminPasswordId}
              name="admin_confirm_password"
              type="password"
              autoComplete="current-password"
              required
              defaultValue=""
            />
            <p className="text-xs text-muted-foreground">This is the password you used to sign in as admin, not the user&apos;s new password.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !fullName.trim()}>
              {busy ? <Spinner /> : null}
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleOptions() {
  return (
    <>
      <option value="staff">Counting Supervisor</option>
      <option value="supervisor">Returning Officer</option>
      <option value="display">Public results display</option>
      <option value="admin">Admin</option>
    </>
  );
}

function PostCheckboxes({
  posts,
  selected,
  onChange,
}: {
  posts: Post[];
  selected?: string[];
  onChange?: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {posts.map((post, index) => (
        <label key={post.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={onChange ? undefined : "post_ids"}
            value={post.id}
            checked={onChange ? selected?.includes(post.id) : undefined}
            onChange={
              onChange
                ? (event) => {
                    const current = selected ?? [];
                    onChange(
                      event.target.checked ? [...current, post.id] : current.filter((id) => id !== post.id),
                    );
                  }
                : undefined
            }
          />
          {postSerial(post, index)}. {post.name}
        </label>
      ))}
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
  const passwordId = useId();
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
            <Label htmlFor={passwordId}>Admin password</Label>
            <Input
              id={passwordId}
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

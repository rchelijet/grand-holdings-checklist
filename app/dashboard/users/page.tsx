"use client";

import { Fragment, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";

interface Facility {
  id: number;
  name: string;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: "admin" | "manager" | "basic";
  facility_id: number | null;
  access_all: number;
  facility_names: string | null;
  facility_ids: number[];
}

type UserRole = "admin" | "manager" | "basic";

interface UserFormState {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  facility_ids: number[];
  access_all: boolean;
}

const emptyAddForm: UserFormState = {
  email: "",
  password: "",
  name: "",
  role: "basic",
  facility_ids: [],
  access_all: false,
};

function PropertyAccessFields({
  role,
  accessAll,
  facilityIds,
  facilities,
  onAccessAllChange,
  onFacilityToggle,
}: {
  role: UserRole;
  accessAll: boolean;
  facilityIds: number[];
  facilities: Facility[];
  onAccessAllChange: (accessAll: boolean) => void;
  onFacilityToggle: (facilityId: number) => void;
}) {
  if (role === "admin") return null;

  return (
    <div className="sm:col-span-2">
      <label className="flex items-center gap-2 text-sm text-forest">
        <input
          type="checkbox"
          checked={accessAll}
          onChange={(e) => onAccessAllChange(e.target.checked)}
        />
        All properties
      </label>
      {!accessAll && (
        <div className="mt-3 flex flex-wrap gap-2">
          {facilities.map((facility) => (
            <label
              key={facility.id}
              className="rounded-full border border-forest/15 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="mr-2"
                checked={facilityIds.includes(facility.id)}
                onChange={() => onFacilityToggle(facility.id)}
              />
              {facility.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleSelect({
  label,
  value,
  onChange,
  showAdmin,
}: {
  label: string;
  value: UserRole;
  onChange: (role: UserRole) => void;
  showAdmin: boolean;
}) {
  return (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value as UserRole)}>
      <option value="basic">Basic (property user)</option>
      <option value="manager">Manager (checklists and tasks)</option>
      {showAdmin && <option value="admin">Full access (admin)</option>}
    </Select>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("basic");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [form, setForm] = useState<UserFormState>(emptyAddForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(emptyAddForm);
  const [editError, setEditError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [usersRes, facilitiesRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/facilities"),
    ]);
    const usersData = await usersRes.json();
    const facilitiesData = await facilitiesRes.json();
    setUsers(usersData.users || []);
    setCurrentUserId(usersData.currentUserId ?? null);
    setCurrentUserRole(usersData.currentUserRole ?? "basic");
    setFacilities(facilitiesData.facilities || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        facility_ids: form.role === "admin" || form.access_all ? [] : form.facility_ids,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create user");
      return;
    }

    setForm(emptyAddForm);
    load();
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditError("");
    setEditForm({
      email: user.email,
      password: "",
      name: user.name,
      role: user.role,
      facility_ids: user.facility_ids,
      access_all: user.access_all === 1,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyAddForm);
    setEditError("");
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) return;

    setEditError("");
    const payload: Record<string, unknown> = {
      email: editForm.email,
      name: editForm.name,
      role: editForm.role,
      access_all: editForm.access_all,
      facility_ids:
        editForm.role === "admin" || editForm.access_all ? [] : editForm.facility_ids,
    };
    if (editForm.password.trim()) {
      payload.password = editForm.password;
    }

    const res = await fetch(`/api/users/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setEditError(data.error || "Failed to update user");
      return;
    }

    cancelEdit();
    load();
  }

  async function handleDeactivate(user: UserRow) {
    if (
      !window.confirm(
        `Deactivate ${user.name}? They will no longer be able to sign in.`
      )
    ) {
      return;
    }

    setError("");
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to deactivate user");
      return;
    }

    if (editingId === user.id) {
      cancelEdit();
    }
    load();
  }

  const isAdmin = currentUserRole === "admin";

  return (
    <div>
      <PageHeader
        title="Team"
        description="Invite managers and set admin or property-level access."
      />

      <Card className="mb-6">
        <h3 className="mb-4 font-serif text-2xl text-forest">Add team member</h3>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <RoleSelect
            label="Access level"
            value={form.role}
            showAdmin={isAdmin}
            onChange={(role) =>
              setForm({
                ...form,
                role,
                facility_ids: [],
                access_all: false,
              })
            }
          />

          <PropertyAccessFields
            role={form.role}
            accessAll={form.access_all}
            facilityIds={form.facility_ids}
            facilities={facilities}
            onAccessAllChange={(accessAll) =>
              setForm({ ...form, access_all: accessAll, facility_ids: [] })
            }
            onFacilityToggle={(facilityId) =>
              setForm({
                ...form,
                facility_ids: form.facility_ids.includes(facilityId)
                  ? form.facility_ids.filter((id) => id !== facilityId)
                  : [...form.facility_ids, facilityId],
              })
            }
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit">Add user</Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <p className="text-forest/70">Loading...</p>
      ) : users.length === 0 ? (
        <EmptyState message="No users found." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-forest/10 text-forest/60">
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Name</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Email</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Role</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Property</th>
                  <th className="px-3 py-2 font-medium tracking-[0.12em] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="border-b border-forest/5">
                      <td className="px-3 py-3 font-medium text-forest">
                        {u.name}
                      </td>
                      <td className="px-3 py-3 text-forest/70">{u.email}</td>
                      <td className="px-3 py-3">
                        <Badge tone={u.role === "admin" ? "success" : "default"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-forest/70">
                        {u.access_all ? "All properties" : u.facility_names || "No properties assigned"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(isAdmin || u.role !== "admin") && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                editingId === u.id ? cancelEdit() : startEdit(u)
                              }
                            >
                              {editingId === u.id ? "Cancel" : "Edit"}
                            </Button>
                          )}
                          {isAdmin && u.id !== currentUserId && (
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => handleDeactivate(u)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === u.id && (
                      <tr className="border-b border-forest/10 bg-cream/40">
                        <td colSpan={5} className="px-3 py-4">
                          <form
                            onSubmit={handleEditSubmit}
                            className="grid gap-4 sm:grid-cols-2"
                          >
                            <Input
                              label="Full name"
                              required
                              value={editForm.name}
                              onChange={(e) =>
                                setEditForm({ ...editForm, name: e.target.value })
                              }
                            />
                            <Input
                              label="Email"
                              type="email"
                              required
                              value={editForm.email}
                              onChange={(e) =>
                                setEditForm({ ...editForm, email: e.target.value })
                              }
                            />
                            <Input
                              label="New password (optional)"
                              type="password"
                              placeholder="Leave blank to keep current password"
                              value={editForm.password}
                              onChange={(e) =>
                                setEditForm({ ...editForm, password: e.target.value })
                              }
                            />
                            <RoleSelect
                              label="Access level"
                              value={editForm.role}
                              showAdmin={isAdmin}
                              onChange={(role) =>
                                setEditForm({
                                  ...editForm,
                                  role,
                                  facility_ids: role === "admin" ? [] : editForm.facility_ids,
                                  access_all: role === "admin" ? false : editForm.access_all,
                                })
                              }
                            />

                            <PropertyAccessFields
                              role={editForm.role}
                              accessAll={editForm.access_all}
                              facilityIds={editForm.facility_ids}
                              facilities={facilities}
                              onAccessAllChange={(accessAll) =>
                                setEditForm({
                                  ...editForm,
                                  access_all: accessAll,
                                  facility_ids: [],
                                })
                              }
                              onFacilityToggle={(facilityId) =>
                                setEditForm({
                                  ...editForm,
                                  facility_ids: editForm.facility_ids.includes(facilityId)
                                    ? editForm.facility_ids.filter((id) => id !== facilityId)
                                    : [...editForm.facility_ids, facilityId],
                                })
                              }
                            />

                            {editError && (
                              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
                                {editError}
                              </p>
                            )}

                            <div className="flex gap-2 sm:col-span-2">
                              <Button type="submit">Save changes</Button>
                              <Button type="button" variant="secondary" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

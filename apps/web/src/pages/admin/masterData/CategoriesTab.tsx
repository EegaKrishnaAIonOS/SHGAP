import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { DataTable, type Column } from "../../../components/ui/Table";
import { ApiError } from "../../../lib/api/httpClient";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../../../lib/api/masterData";
import type { Category } from "../../../lib/api/types";

const emptyForm = { name: "", slug: "", parentId: "" };

interface FlatCategory extends Category {
  parentName: string | null;
}

function flatten(categories: Category[]): FlatCategory[] {
  const rows: FlatCategory[] = [];
  for (const parent of categories) {
    rows.push({ ...parent, parentName: null });
    for (const child of parent.children ?? []) {
      rows.push({ ...child, parentName: parent.name });
    }
  }
  return rows;
}

export function CategoriesTab() {
  const [tree, setTree] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FlatCategory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    getCategories()
      .then(setTree)
      .catch(() => setError("Couldn't load this list. Please try again."))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  const rows = flatten(tree);
  const parentOptions = tree.map((c) => ({ value: c.id, label: c.name }));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(category: FlatCategory) {
    setEditing(category);
    setForm({ name: category.name, slug: category.slug, parentId: category.parentId ?? "" });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);
    try {
      const input = { name: form.name, slug: form.slug, parentId: form.parentId || undefined };
      if (editing) {
        await updateCategory(editing.id, input);
      } else {
        await createCategory(input);
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: FlatCategory) {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;
    try {
      await deleteCategory(category.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this. Please try again.");
    }
  }

  const columns: Column<FlatCategory>[] = [
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "slug", header: "Slug", render: (row) => row.slug },
    {
      key: "parent",
      header: "Category group",
      render: (row) => row.parentName ?? "—",
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          Add category
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyMessage={loading ? "Loading..." : "Nothing here yet."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit category" : "Add category"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={saving} onClick={() => void handleSubmit()}>
              Save
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <Select
            label="Category group"
            options={parentOptions}
            placeholder="Top-level category (no parent)"
            value={form.parentId}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            required
          />
          {formError && <p className="text-sm text-danger-500">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}

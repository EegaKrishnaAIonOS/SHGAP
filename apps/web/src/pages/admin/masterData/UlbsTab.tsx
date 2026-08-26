import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { DataTable, type Column } from "../../../components/ui/Table";
import { ApiError } from "../../../lib/api/httpClient";
import {
  createUlb,
  deleteUlb,
  getDistricts,
  listAllUlbs,
  updateUlb,
} from "../../../lib/api/masterData";
import type { District, Ulb } from "../../../lib/api/types";

const emptyForm = { name: "", code: "", districtId: "" };

export function UlbsTab() {
  const [ulbs, setUlbs] = useState<Ulb[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ulb | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([listAllUlbs(), getDistricts()])
      .then(([ulbList, districtList]) => {
        setUlbs(ulbList);
        setDistricts(districtList);
      })
      .catch(() => setError("Couldn't load this list. Please try again."))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  const districtOptions = districts.map((d) => ({ value: d.id, label: d.name }));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(ulb: Ulb) {
    setEditing(ulb);
    setForm({ name: ulb.name, code: ulb.code, districtId: ulb.districtId });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateUlb(editing.id, form);
      } else {
        await createUlb(form);
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ulb: Ulb) {
    if (!window.confirm(`Delete "${ulb.name}"? This can't be undone.`)) return;
    try {
      await deleteUlb(ulb.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this. Please try again.");
    }
  }

  const columns: Column<Ulb>[] = [
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "code", header: "Code", render: (row) => row.code },
    {
      key: "district",
      header: "District",
      render: (row) => row.district?.name ?? "—",
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
          Add ULB
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <DataTable
        columns={columns}
        rows={ulbs}
        rowKey={(row) => row.id}
        emptyMessage={loading ? "Loading..." : "Nothing here yet."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit ULB" : "Add ULB"}
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
            label="District"
            options={districtOptions}
            placeholder="Select a category group"
            value={form.districtId}
            onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value }))}
            required
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            required
          />
          {formError && <p className="text-sm text-danger-500">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}

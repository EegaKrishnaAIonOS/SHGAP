import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { DataTable, type Column } from "../../../components/ui/Table";
import { ApiError } from "../../../lib/api/httpClient";
import {
  createFestivalCalendarEntry,
  deleteFestivalCalendarEntry,
  getDistricts,
  getFestivalCalendar,
  updateFestivalCalendarEntry,
} from "../../../lib/api/masterData";
import type { District, FestivalCalendarEntry } from "../../../lib/api/types";

const emptyForm = {
  name: "",
  startDate: "",
  endDate: "",
  recurring: true,
  districtId: "",
  description: "",
};

export function FestivalCalendarTab() {
  const [entries, setEntries] = useState<FestivalCalendarEntry[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FestivalCalendarEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([getFestivalCalendar(), getDistricts()])
      .then(([entryList, districtList]) => {
        setEntries(entryList);
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

  function openEdit(entry: FestivalCalendarEntry) {
    setEditing(entry);
    setForm({
      name: entry.name,
      startDate: entry.startDate.slice(0, 10),
      endDate: entry.endDate.slice(0, 10),
      recurring: entry.recurring,
      districtId: entry.districtId ?? "",
      description: entry.description ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);
    try {
      const input = {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        recurring: form.recurring,
        districtId: form.districtId || undefined,
        description: form.description || undefined,
      };
      if (editing) {
        await updateFestivalCalendarEntry(editing.id, input);
      } else {
        await createFestivalCalendarEntry(input);
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: FestivalCalendarEntry) {
    if (!window.confirm(`Delete "${entry.name}"? This can't be undone.`)) return;
    try {
      await deleteFestivalCalendarEntry(entry.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this. Please try again.");
    }
  }

  const columns: Column<FestivalCalendarEntry>[] = [
    { key: "name", header: "Name", render: (row) => row.name },
    {
      key: "dates",
      header: "Dates",
      render: (row) => `${row.startDate.slice(0, 10)} — ${row.endDate.slice(0, 10)}`,
    },
    {
      key: "district",
      header: "District",
      render: (row) => row.district?.name ?? "Statewide",
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
          Add festival
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <DataTable
        columns={columns}
        rows={entries}
        rowKey={(row) => row.id}
        emptyMessage={loading ? "Loading..." : "Nothing here yet."}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit festival" : "Add festival"}
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
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              required
            />
            <Input
              label="End date"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              required
            />
          </div>
          <Select
            label="District"
            options={districtOptions}
            placeholder="Statewide"
            value={form.districtId}
            onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value }))}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300"
            />
            Recurs every year
          </label>
          {formError && <p className="text-sm text-danger-500">{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}

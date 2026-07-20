import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { DataTable, type Column } from "../../../components/ui/Table";
import { ApiError } from "../../../lib/api/httpClient";
import {
  createDistrict,
  deleteDistrict,
  getDistricts,
  updateDistrict,
} from "../../../lib/api/masterData";
import type { District } from "../../../lib/api/types";

const emptyForm = { name: "", code: "" };

export function DistrictsTab() {
  const { t } = useTranslation();
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<District | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    getDistricts()
      .then(setDistricts)
      .catch(() => setError(t("admin.masterData.loadError")))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [t]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(district: District) {
    setEditing(district);
    setForm({ name: district.name, code: district.code });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateDistrict(editing.id, form);
      } else {
        await createDistrict(form);
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("admin.masterData.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(district: District) {
    if (!window.confirm(t("admin.masterData.confirmDelete", { name: district.name }))) return;
    try {
      await deleteDistrict(district.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.masterData.deleteError"));
    }
  }

  const columns: Column<District>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "code", header: t("admin.masterData.code"), render: (row) => row.code },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
            {t("common.edit")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          {t("admin.masterData.addDistrict")}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <DataTable
        columns={columns}
        rows={districts}
        rowKey={(row) => row.id}
        emptyMessage={loading ? t("common.loading") : t("admin.masterData.noneFound")}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("admin.masterData.editDistrict") : t("admin.masterData.addDistrict")}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button isLoading={saving} onClick={() => void handleSubmit()}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <Input
            label={t("dashboard.name")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label={t("admin.masterData.code")}
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

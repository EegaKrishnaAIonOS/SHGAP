import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { DataTable, type Column } from "../../../components/ui/Table";
import { ApiError } from "../../../lib/api/httpClient";
import {
  createMandal,
  deleteMandal,
  getDistricts,
  listAllMandals,
  updateMandal,
} from "../../../lib/api/masterData";
import type { District, Mandal } from "../../../lib/api/types";

const emptyForm = { name: "", code: "", districtId: "" };

export function MandalsTab() {
  const { t } = useTranslation();
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Mandal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([listAllMandals(), getDistricts()])
      .then(([mandalList, districtList]) => {
        setMandals(mandalList);
        setDistricts(districtList);
      })
      .catch(() => setError(t("admin.masterData.loadError")))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [t]);

  const districtOptions = districts.map((d) => ({ value: d.id, label: d.name }));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(mandal: Mandal) {
    setEditing(mandal);
    setForm({ name: mandal.name, code: mandal.code, districtId: mandal.districtId });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateMandal(editing.id, form);
      } else {
        await createMandal(form);
      }
      setModalOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("admin.masterData.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mandal: Mandal) {
    if (!window.confirm(t("admin.masterData.confirmDelete", { name: mandal.name }))) return;
    try {
      await deleteMandal(mandal.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.masterData.deleteError"));
    }
  }

  const columns: Column<Mandal>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "code", header: t("admin.masterData.code"), render: (row) => row.code },
    {
      key: "district",
      header: t("registration.district"),
      render: (row) => row.district?.name ?? "—",
    },
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
          {t("admin.masterData.addMandal")}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger-500">{error}</p>}

      <DataTable
        columns={columns}
        rows={mandals}
        rowKey={(row) => row.id}
        emptyMessage={loading ? t("common.loading") : t("admin.masterData.noneFound")}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("admin.masterData.editMandal") : t("admin.masterData.addMandal")}
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
          <Select
            label={t("registration.district")}
            options={districtOptions}
            placeholder={t("catalogue.form.categoryGroupPlaceholder")}
            value={form.districtId}
            onChange={(e) => setForm((f) => ({ ...f, districtId: e.target.value }))}
            required
          />
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

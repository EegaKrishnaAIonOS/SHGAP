import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Card, CardTitle } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { Modal } from "../../components/ui/Modal";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "districtOfficer" | "ulbOfficer";
  status: "active" | "inactive";
}

const initialUsers: AdminUser[] = [
  {
    id: "u1",
    name: "K. Ramesh",
    email: "ramesh@mepma.ap.gov.in",
    role: "districtOfficer",
    status: "active",
  },
  {
    id: "u2",
    name: "P. Anitha",
    email: "anitha@mepma.ap.gov.in",
    role: "ulbOfficer",
    status: "active",
  },
  {
    id: "u3",
    name: "S. Krishna",
    email: "krishna@mepma.ap.gov.in",
    role: "admin",
    status: "active",
  },
  {
    id: "u4",
    name: "M. Divya",
    email: "divya@mepma.ap.gov.in",
    role: "ulbOfficer",
    status: "inactive",
  },
];

interface FeatureFlag {
  id: string;
  label: string;
  enabled: boolean;
}

const initialFlags: FeatureFlag[] = [
  { id: "f1", label: "Voice assistant (Telugu ASR)", enabled: true },
  { id: "f2", label: "Buyer self-registration", enabled: true },
  { id: "f3", label: "AI product description generation", enabled: false },
];

interface ModerationItem {
  id: string;
  item: string;
  submittedBy: string;
  status: "pending" | "flagged";
}

const moderationItems: ModerationItem[] = [
  {
    id: "m1",
    item: "Product photo — Palm Leaf Basket",
    submittedBy: "Sneha SHG",
    status: "pending",
  },
  {
    id: "m2",
    item: "Product description — Red Chilli Powder",
    submittedBy: "Lakshmi SHG",
    status: "flagged",
  },
];

/**
 * Admin wireframe: platform-administration surface (users/roles, feature
 * flags, content moderation). Desktop-oriented like the other official
 * screens. The "Invite user" flow demonstrates the Modal component from the
 * shared library end-to-end (open/focus-trap/submit/close).
 */
export function AdminPage() {
  const { t } = useTranslation();
  const [users] = useState(initialUsers);
  const [flags, setFlags] = useState(initialFlags);
  const [inviteOpen, setInviteOpen] = useState(false);

  const roleLabels: Record<AdminUser["role"], string> = {
    admin: t("admin.roleAdmin"),
    districtOfficer: t("admin.roleDistrictOfficer"),
    ulbOfficer: t("admin.roleUlbOfficer"),
  };

  const userColumns: Column<AdminUser>[] = [
    { key: "name", header: t("dashboard.name"), render: (row) => row.name },
    { key: "email", header: t("admin.email"), render: (row) => row.email },
    { key: "role", header: t("admin.role"), render: (row) => roleLabels[row.role] },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => (
        <span
          className={
            row.status === "active"
              ? "rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700"
              : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500"
          }
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: () => (
        <Button size="sm" variant="ghost">
          {t("common.viewDetails")}
        </Button>
      ),
    },
  ];

  const moderationColumns: Column<ModerationItem>[] = [
    { key: "item", header: t("dashboard.name"), render: (row) => row.item },
    { key: "submittedBy", header: "SHG", render: (row) => row.submittedBy },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => (
        <span
          className={
            row.status === "flagged"
              ? "rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700"
              : "rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700"
          }
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: () => (
        <Button size="sm" variant="outline">
          {t("common.viewDetails")}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
        action={<Button onClick={() => setInviteOpen(true)}>{t("admin.inviteUser")}</Button>}
      />

      <Card className="mb-5">
        <CardTitle className="mb-3">{t("admin.users")}</CardTitle>
        <DataTable columns={userColumns} rows={users} rowKey={(row) => row.id} />
      </Card>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">{t("admin.featureFlags")}</CardTitle>
          <ul className="flex flex-col divide-y divide-neutral-100">
            {flags.map((flag) => (
              <li key={flag.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-neutral-700">{flag.label}</span>
                <Button
                  size="sm"
                  variant={flag.enabled ? "primary" : "outline"}
                  onClick={() =>
                    setFlags((prev) =>
                      prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f)),
                    )
                  }
                  aria-pressed={flag.enabled}
                >
                  {flag.enabled ? t("common.status") + ": ON" : t("common.status") + ": OFF"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle className="mb-3">{t("admin.moderationQueue")}</CardTitle>
          <DataTable columns={moderationColumns} rows={moderationItems} rowKey={(row) => row.id} />
        </Card>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t("admin.inviteUserTitle")}
        description={t("admin.inviteUserBody")}
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => setInviteOpen(false)}>{t("admin.sendInvite")}</Button>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <Input label={t("admin.email")} type="email" required />
          <Select
            label={t("admin.role")}
            required
            options={[
              { value: "admin", label: t("admin.roleAdmin") },
              { value: "districtOfficer", label: t("admin.roleDistrictOfficer") },
              { value: "ulbOfficer", label: t("admin.roleUlbOfficer") },
            ]}
            placeholder={t("admin.role")}
          />
        </form>
      </Modal>
    </div>
  );
}

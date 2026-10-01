import { Check, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import { Fragment } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { STAFF_STATUS } from "@/components/admin/admin-status";
import { Chip } from "@/components/admin/bits";
import { sp } from "@/components/admin/helpers";
import { InviteMember } from "@/components/admin/invite-member";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { adminRoles, MATRIX_ROLES, permissionMatrix, staffDirectory, type PermissionLevel } from "@/lib/mock/admin-extra";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Team and roles" };

const SHORT: Record<string, string> = {
  super_admin: "Super Admin",
  ops_admin: "Ops Admin",
  kyc: "KYC",
  catalog_mod: "Catalog QC",
  category_mgr: "Category",
  marketing: "Marketing",
  finance_mgr: "Finance Mgr",
  finance_exec: "Finance Exec",
  risk: "Risk",
  trust: "Trust",
  auditor: "Auditor",
};

function Cell({ level }: { level: PermissionLevel }) {
  if (level === "full") return <Check size={16} strokeWidth={2.4} className="mx-auto text-success-600" aria-label="Full access" />;
  if (level === "view") return <Eye size={15} className="mx-auto text-ink-400" aria-label="View only" />;
  if (level === "none")
    return (
      <span className="text-ink-300" aria-label="No access">
        -
      </span>
    );
  const label = { maker: "Maker", checker: "Checker", limited: "Limit" }[level];
  const cls = { maker: "border-info-100 bg-info-50 text-info-700", checker: "border-warning-100 bg-warning-50 text-warning-700", limited: "border-line bg-ink-50 text-ink-600" }[level];
  return <Chip className={cls}>{label}</Chip>;
}

export default async function TeamPage(props: PageProps<"/admin/team">) {
  const params = await props.searchParams;
  const tab = (["members", "roles", "permissions"] as const).find((t) => t === sp(params, "tab")) ?? "members";
  const roleName = (id: string) => adminRoles.find((r) => r.id === id)?.name ?? id;
  const groups = [...new Set(permissionMatrix.map((r) => r.group))];

  return (
    <>
      <PageHeader title="Team and roles" description="Who can do what in BluBuy Control. Permissions are resource:action pairs bundled into roles; money movement uses maker-checker and every write is audited." actions={<InviteMember roles={adminRoles.map((r) => ({ id: r.id, name: r.name, scope: r.scope }))} />} />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Active members", value: staffDirectory.filter((s) => s.status === "active").length, hint: "in this workspace" },
          { label: "Pending invites", value: staffDirectory.filter((s) => s.status === "invited").length, hint: "expire after 7 days" },
          { label: "MFA coverage", value: `${Math.round((staffDirectory.filter((s) => s.mfa && s.status === "active").length / staffDirectory.filter((s) => s.status === "active").length) * 100)}%`, hint: "of active members" },
          { label: "Roles", value: adminRoles.length, hint: "spec roles A1 to A18" },
        ]}
      />

      <TabLinks
        className="mb-5"
        active={tab}
        items={[
          { key: "members", label: "Members", count: staffDirectory.length, href: "/admin/team" },
          { key: "roles", label: "Roles", count: adminRoles.length, href: "/admin/team?tab=roles" },
          { key: "permissions", label: "Permissions matrix", href: "/admin/team?tab=permissions" },
        ]}
      />

      {tab === "members" && (
        <Card>
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Member</TH>
                  <TH>Role</TH>
                  <TH className="hidden 2xl:table-cell">Scope</TH>
                  <TH className="hidden sm:table-cell">MFA</TH>
                  <TH className="hidden md:table-cell">Last active</TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {staffDirectory.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink-900">{s.name}</p>
                          <p className="text-xs text-ink-500">{s.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <p className="text-[13px] text-ink-800">{roleName(s.roleId)}</p>
                      <p className="max-w-[220px] truncate text-xs text-ink-500">
                        {s.team}, {s.scope}
                      </p>
                    </TD>
                    <TD className="hidden max-w-[200px] truncate text-[13px] text-ink-600 2xl:table-cell">{s.scope}</TD>
                    <TD className="hidden sm:table-cell">
                      {s.mfa ? (
                        <span className="inline-flex items-center gap-1 text-[13px] text-success-700">
                          <ShieldCheck size={14} aria-hidden="true" />
                          On
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[13px] text-warning-700">
                          <ShieldAlert size={14} aria-hidden="true" />
                          Off
                        </span>
                      )}
                    </TD>
                    <TD className="hidden text-[13px] text-ink-600 md:table-cell">
                      {s.status === "invited" ? "Not yet" : timeAgo(s.lastActive)}
                      {s.lastIp && <p className="font-mono text-xs text-ink-400">{s.lastIp}</p>}
                    </TD>
                    <TD>
                      <StatusBadge meta={STAFF_STATUS[s.status]} size="sm" />
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1.5">
                        {s.status === "invited" ? (
                          <ActionButton label="Resend" icon="mail" size="xs" variant="ghost" title={`Resend invite to ${s.name}`} note="none" toast="Invite resent" doneLabel="Sent" />
                        ) : (
                          <ActionButton label="Change role" size="xs" variant="ghost" title={`Change role for ${s.name}`} description="Role changes take effect at the next sign in and are recorded in the audit log." fields={[{ name: "role", label: "Role", type: "select", options: adminRoles.map((r) => r.name), defaultValue: roleName(s.roleId) }]} note="required" toast="Role updated" disabled={s.id === "u-1"} />
                        )}
                        {s.status === "active" && s.id !== "u-1" && <ActionButton label="Deactivate" size="xs" variant="ghost" danger title={`Deactivate ${s.name}`} description="Signs them out everywhere and revokes API tokens. Their audit history is kept." reasons={["Left the company", "Role change", "Security concern"]} note="optional" toast="Member deactivated" doneLabel="Deactivated" />}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === "roles" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminRoles.map((r) => (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{r.name}</p>
                  <p className="font-mono text-xs text-ink-500">{r.code}</p>
                </div>
                <span className="text-[13px] text-ink-600 tabular-nums">
                  {r.members} {r.members === 1 ? "member" : "members"}
                </span>
              </div>
              <p className="mt-2 flex-1 text-[13px] text-ink-600">{r.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                <Chip>{r.scope}</Chip>
                {r.makerChecker && <Chip className={r.makerChecker === "Checker" ? "border-warning-100 bg-warning-50 text-warning-700" : "border-info-100 bg-info-50 text-info-700"}>{r.makerChecker}</Chip>}
                {r.limit && <span className="text-xs text-ink-500">{r.limit}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "permissions" && (
        <Card>
          <CardHeader
            title="Permissions matrix"
            description="Key capabilities by role. Maker prepares, Checker approves; the same person can never do both on one item."
            action={
              <ActionButton label="Create custom role" icon="plus" size="sm" title="Create a custom role" description="Start from an existing role and adjust permissions and monetary limits." fields={[{ name: "base", label: "Start from", type: "select", options: adminRoles.map((r) => r.name) }, { name: "name", label: "Role name" }]} note="optional" toast="Draft role created" />
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <Check size={14} strokeWidth={2.4} className="text-success-600" aria-hidden="true" />
              Full
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye size={14} className="text-ink-400" aria-hidden="true" />
              View only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Chip className="border-info-100 bg-info-50 text-info-700">Maker</Chip>
              Prepares
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Chip className="border-warning-100 bg-warning-50 text-warning-700">Checker</Chip>
              Approves
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Chip>Limit</Chip>
              Within a monetary or scope limit
            </span>
          </div>
          <TableContainer>
            <Table>
              <THead>
                <TR>
                  <TH className="sticky left-0 z-10 bg-ink-50">Capability</TH>
                  {MATRIX_ROLES.map((r) => (
                    <TH key={r} align="center" className="w-20 px-2 text-[11.5px] whitespace-normal">
                      {SHORT[r]}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {groups.map((g) => (
                  <Fragment key={g}>
                    <TR className="bg-ink-25 hover:bg-ink-25">
                      <TD colSpan={MATRIX_ROLES.length + 1} className="py-2 text-xs font-semibold text-ink-500">
                        {g}
                      </TD>
                    </TR>
                    {permissionMatrix
                      .filter((p) => p.group === g)
                      .map((p) => (
                        <TR key={p.perm}>
                          <TD className="sticky left-0 z-10 bg-surface">
                            <p className="text-[13px] text-ink-800">{p.label}</p>
                            <p className="font-mono text-[11px] text-ink-400">{p.perm}</p>
                          </TD>
                          {MATRIX_ROLES.map((r) => (
                            <TD key={r} align="center" className="px-2">
                              <Cell level={p.levels[r]!} />
                            </TD>
                          ))}
                        </TR>
                      ))}
                  </Fragment>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </>
  );
}

import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { STAFF_ROLES } from "../../db/schema.js";
import { CurrentUser, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import { AuditService } from "./audit.service.js";
import * as s from "./staff.schemas.js";
import { StaffService } from "./staff.service.js";

const staffId = { schema: z.uuid() };
const who = (m: { name: string | null; email: string }) => m.name ?? m.email;
const ROLE_ORDER = new Map<string, number>(STAFF_ROLES.map((r, i) => [r, i]));
/** Roles in a fixed order, so the audit diff shows real changes only. */
const sorted = (roles: readonly string[]) => [...roles].sort((a, b) => (ROLE_ORDER.get(a) ?? 99) - (ROLE_ORDER.get(b) ?? 99));

/** Who works in AltasGoods Control, with which roles. Super Admins only; every change is in the audit log. */
@ApiTags("Admin staff")
@ApiBearerAuth()
@StaffOnly("SUPER_ADMIN")
@Controller("v1/admin/staff")
export class StaffController {
  constructor(
    @Inject(StaffService) private readonly svc: StaffService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: z.array(s.staffMember) })
  list() {
    return this.svc.list();
  }

  /** Invite by email, or set a temporary password that must be changed at first sign in. */
  @Post()
  @ApiResponse({ status: 201, standardSchema: s.staffCreateResponse })
  async create(@CurrentUser() u: AuthUser, @Body({ schema: s.staffCreateBody }) body: z.infer<typeof s.staffCreateBody>) {
    const out = await this.svc.create(body);
    const how = body.mode === "invite" ? "sent an invite" : "set a temporary password";
    await this.audit.log(u, "staff.create", { type: "staff", id: out.member.id }, `Added ${who(out.member)} as staff (${sorted(out.member.roles).join(", ")}) and ${how}`, {
      roles: [[], sorted(out.member.roles)],
    });
    return out;
  }

  @Patch(":id")
  @ApiResponse({ status: 200, standardSchema: s.staffMember })
  async setRoles(@CurrentUser() u: AuthUser, @Param("id", staffId) id: string, @Body({ schema: s.staffRolesBody }) body: z.infer<typeof s.staffRolesBody>) {
    const { before, after } = await this.svc.setRoles(u.id, id, body.roles);
    const [from, to] = [sorted(before), sorted(after.roles)];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      await this.audit.log(u, "staff.roles", { type: "staff", id }, `Changed the roles of ${who(after)} to ${to.join(", ")}`, { roles: [from, to] });
    }
    return after;
  }

  @Post(":id/disable")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.staffMember })
  async disable(@CurrentUser() u: AuthUser, @Param("id", staffId) id: string) {
    const { before, after } = await this.svc.setStatus(u.id, id, "BLOCKED");
    if (before !== after.status) await this.audit.log(u, "staff.disable", { type: "staff", id }, `Disabled ${who(after)} and signed them out everywhere`, { status: [before, after.status] });
    return after;
  }

  @Post(":id/enable")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.staffMember })
  async enable(@CurrentUser() u: AuthUser, @Param("id", staffId) id: string) {
    const { before, after } = await this.svc.setStatus(u.id, id, "ACTIVE");
    if (before !== after.status) await this.audit.log(u, "staff.enable", { type: "staff", id }, `Enabled ${who(after)}`, { status: [before, after.status] });
    return after;
  }

  /** Takes away every staff role and ends their sessions. Their account stays, as a shopper. */
  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param("id", staffId) id: string) {
    const before = await this.svc.remove(u.id, id);
    await this.audit.log(u, "staff.remove", { type: "staff", id }, `Removed ${who(before)} from staff`, { roles: [sorted(before.staffRoles), []] });
  }

  /** Emails a new invite link; the earlier one stops working. */
  @Post(":id/invite")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.staffInviteResponse })
  async resendInvite(@CurrentUser() u: AuthUser, @Param("id", staffId) id: string) {
    const out = await this.svc.resendInvite(id);
    await this.audit.log(u, "staff.invite", { type: "staff", id }, `Sent ${who(out.member)} a new invite link`);
    return out;
  }
}

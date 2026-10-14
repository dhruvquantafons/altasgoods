import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiResponse, ApiTags, type ApiBodyOptions } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { CurrentUser, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import * as s from "./support.schemas.js";
import { AuditService } from "../admin/audit.service.js";
import { SupportLookupService } from "./support-lookup.service.js";
import { SupportService } from "./support.service.js";

const ticketId = { schema: z.string().regex(/^TK-\d+$/, "Ticket ids look like TK-51908") };
const uuidParam = { schema: z.uuid() };
const uploadSpec: ApiBodyOptions = {
  schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "PDF, PNG or JPG, up to 4 MB" } } },
};
type Upload = { originalname: string; buffer: Buffer; size: number } | undefined;

function sendFile(res: Response, file: { content: Buffer; mimeType: string; fileName: string }) {
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.content);
}

/** Customers in AltasGoods Control: the same lookup the Care Desk uses, plus blocking an account. */
@ApiTags("Admin")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN")
@Controller("v1/admin/customers")
export class AdminCustomersController {
  constructor(
    @Inject(SupportLookupService) private readonly lookup: SupportLookupService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: s.customerList })
  list(@Query({ schema: s.customerSearchQuery }) q: z.infer<typeof s.customerSearchQuery>) {
    return this.lookup.customers(q);
  }

  @Get(":id")
  @ApiResponse({ status: 200, standardSchema: s.customerProfile })
  get(@Param("id", uuidParam) id: string) {
    return this.lookup.customer(id);
  }

  /** Blocking signs the customer out everywhere and stops them signing in; their orders carry on. */
  @Patch(":id")
  @ApiResponse({ status: 200, standardSchema: s.customerProfile })
  async setStatus(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.customerStatusBody }) body: z.infer<typeof s.customerStatusBody>) {
    const before = await this.lookup.customer(id);
    const after = await this.lookup.setStatus(id, body.status);
    if (before.status !== after.status) {
      await this.audit.log(u, body.status === "BLOCKED" ? "customer.block" : "customer.unblock", { type: "customer", id }, `${body.status === "BLOCKED" ? "Blocked" : "Unblocked"} ${after.name ?? after.email}${body.reason ? `: ${body.reason}` : ""}`, { status: [before.status, after.status] });
    }
    return after;
  }
}

@ApiTags("Care Desk")
@ApiBearerAuth()
@StaffOnly("SUPPORT_AGENT", "SUPPORT_SPECIALIST", "SUPPORT_SUPERVISOR")
@Controller("v1/support")
export class SupportController {
  constructor(
    @Inject(SupportService) private readonly svc: SupportService,
    @Inject(SupportLookupService) private readonly lookup: SupportLookupService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get("customers")
  @ApiResponse({ status: 200, standardSchema: s.customerList })
  customers(@Query({ schema: s.customerSearchQuery }) q: z.infer<typeof s.customerSearchQuery>) {
    return this.lookup.customers(q);
  }

  @Get("customers/:id")
  @ApiResponse({ status: 200, standardSchema: s.customerProfile })
  customer(@Param("id", uuidParam) id: string) {
    return this.lookup.customer(id);
  }

  @Get("orders")
  @ApiResponse({ status: 200, standardSchema: z.array(s.supportOrderRow) })
  orders(@Query({ schema: s.orderSearchQuery }) q: z.infer<typeof s.orderSearchQuery>) {
    return this.lookup.orders(q);
  }

  @Get("orders/:id")
  @ApiResponse({ status: 200, standardSchema: s.supportOrderDetail })
  order(@Param("id", { schema: z.string().max(40) }) id: string) {
    return this.lookup.order(id);
  }

  @Get("tickets")
  @ApiResponse({ status: 200, standardSchema: s.ticketList })
  list(@CurrentUser() u: AuthUser, @Query({ schema: s.listQuery }) q: z.infer<typeof s.listQuery>) {
    return this.svc.list(u.id, q);
  }

  @Post("tickets")
  @ApiResponse({ status: 201, standardSchema: s.ticketDetail })
  async create(@CurrentUser() u: AuthUser, @Body({ schema: s.staffCreateBody }) body: z.infer<typeof s.staffCreateBody>) {
    return this.svc.createForStaff(await this.svc.staff(u.id), body);
  }

  @Get("agents")
  @ApiResponse({ status: 200, standardSchema: s.agentsSchema })
  agents() {
    return this.svc.agents();
  }

  @Get("tickets/:id")
  @ApiResponse({ status: 200, standardSchema: s.ticketDetail })
  async detail(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string) {
    return this.svc.detail(await this.svc.staff(u.id), id);
  }

  @Patch("tickets/:id")
  @ApiResponse({ status: 200, standardSchema: s.ticketDetail })
  async update(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string, @Body({ schema: s.updateBody }) body: z.infer<typeof s.updateBody>) {
    return this.svc.update(await this.svc.staff(u.id), id, body);
  }

  @Post("tickets/assign")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.object({ updated: z.number().int() }) })
  async bulkAssign(@CurrentUser() u: AuthUser, @Body({ schema: s.bulkAssignBody }) body: z.infer<typeof s.bulkAssignBody>) {
    return this.svc.bulkAssign(await this.svc.staff(u.id), body.ids, body.assigneeId);
  }

  @Post("tickets/:id/messages")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.ticketDetail })
  async message(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string, @Body({ schema: s.messageBody }) body: z.infer<typeof s.messageBody>) {
    return this.svc.message(await this.svc.staff(u.id), id, body);
  }

  @Post("tickets/:id/actions")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.ticketDetail })
  async act(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string, @Body({ schema: s.actionBody }) body: z.infer<typeof s.actionBody>) {
    const t = await this.svc.act(await this.svc.staff(u.id), id, body);
    const latest = t.actions.at(-1);
    await this.audit.log(u, `ticket.${body.kind.toLowerCase()}`, { type: "ticket", id }, `${body.kind.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} on ticket ${id}${latest ? ` (${latest.status.toLowerCase().replace(/_/g, " ")})` : ""}`);
    return t;
  }

  @Post("actions/:id/approve")
  @HttpCode(200)
  @StaffOnly("SUPPORT_SUPERVISOR")
  @ApiResponse({ status: 200, standardSchema: s.ticketDetail })
  async approve(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.decisionBody }) body: z.infer<typeof s.decisionBody>) {
    const t = await this.svc.decide(await this.svc.staff(u.id), id, true, body.note);
    await this.audit.log(u, "ticket.approve", { type: "ticket", id: t.id }, `Approved a refund request on ticket ${t.id}`);
    return t;
  }

  @Post("actions/:id/reject")
  @HttpCode(200)
  @StaffOnly("SUPPORT_SUPERVISOR")
  @ApiResponse({ status: 200, standardSchema: s.ticketDetail })
  async reject(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.decisionBody }) body: z.infer<typeof s.decisionBody>) {
    const t = await this.svc.decide(await this.svc.staff(u.id), id, false, body.note);
    await this.audit.log(u, "ticket.reject", { type: "ticket", id: t.id }, `Rejected a refund request on ticket ${t.id}`);
    return t;
  }

  @Post("tickets/:id/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiBody(uploadSpec)
  @ApiResponse({ status: 201, standardSchema: s.attachmentSchema })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  attach(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string, @UploadedFile() file: Upload) {
    return this.svc.attach(id, { id: u.id }, file);
  }

  @Get("attachments/:id")
  @ApiProduces("application/pdf", "image/png", "image/jpeg")
  async attachment(@Param("id", uuidParam) id: string, @Res() res: Response) {
    sendFile(res, await this.svc.attachmentFile(id));
  }
}

@ApiTags("Help and support")
@ApiBearerAuth()
@Controller("v1/me/support")
export class CustomerSupportController {
  constructor(@Inject(SupportService) private readonly svc: SupportService) {}

  @Get("tickets")
  @ApiResponse({ status: 200, standardSchema: z.array(s.customerTicket) })
  list(@CurrentUser() u: AuthUser) {
    return this.svc.customerTickets(u.id);
  }

  @Post("tickets")
  @ApiResponse({ status: 201, standardSchema: s.customerTicket })
  create(@CurrentUser() u: AuthUser, @Body({ schema: s.createTicketBody }) body: z.infer<typeof s.createTicketBody>) {
    return this.svc.createForCustomer(u.id, body);
  }

  @Get("tickets/:id")
  @ApiResponse({ status: 200, standardSchema: s.customerTicket })
  get(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string) {
    return this.svc.customerTicket(u.id, id);
  }

  @Post("tickets/:id/messages")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.customerTicket })
  reply(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string, @Body({ schema: s.customerReplyBody }) body: z.infer<typeof s.customerReplyBody>) {
    return this.svc.customerReply(u.id, id, body.body, body.attachmentIds);
  }

  @Post("tickets/:id/attachments")
  @ApiConsumes("multipart/form-data")
  @ApiBody(uploadSpec)
  @ApiResponse({ status: 201, standardSchema: s.attachmentSchema })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  async attach(@CurrentUser() u: AuthUser, @Param("id", ticketId) id: string, @UploadedFile() file: Upload) {
    await this.svc.customerTicket(u.id, id);
    return this.svc.attach(id, { id: u.id }, file);
  }

  @Get("attachments/:id")
  @ApiProduces("application/pdf", "image/png", "image/jpeg")
  async attachment(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Res() res: Response) {
    sendFile(res, await this.svc.attachmentFile(id, { userId: u.id }));
  }
}

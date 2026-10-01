import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiResponse, ApiTags, type ApiBodyOptions } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { forbidden } from "../../../common/errors.js";
import { isProduction } from "../../../config/env.js";
import { CurrentSeller, CurrentUser, SellerScoped, type AuthUser } from "../../auth/auth.guard.js";
import * as s from "./returns.schemas.js";
import { ReturnsService } from "./returns.service.js";

const returnId = { schema: z.string().regex(/^RT-\d+$/, "Return ids look like RT-70001") };
const uuidParam = { schema: z.uuid() };
const photoSpec: ApiBodyOptions = { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "PNG or JPG, up to 4 MB" } } } };
type Upload = { originalname: string; buffer: Buffer; size: number } | undefined;

function sendFile(res: Response, file: { content: Buffer; mimeType: string; fileName: string }) {
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.content);
}

@ApiTags("Returns")
@ApiBearerAuth()
@Controller("v1/me")
export class CustomerReturnsController {
  constructor(@Inject(ReturnsService) private readonly svc: ReturnsService) {}

  @Get("returns")
  @ApiResponse({ status: 200, standardSchema: z.array(s.returnSchema) })
  list(@CurrentUser() u: AuthUser) {
    return this.svc.mine(u.id);
  }

  @Post("returns")
  @ApiResponse({ status: 201, standardSchema: s.returnSchema })
  create(@CurrentUser() u: AuthUser, @Body({ schema: s.createReturnBody }) body: z.infer<typeof s.createReturnBody>) {
    return this.svc.create(u.id, body);
  }

  @Get("returns/:id")
  @ApiResponse({ status: 200, standardSchema: s.returnSchema })
  get(@CurrentUser() u: AuthUser, @Param("id", returnId) id: string) {
    return this.svc.mineOne(u.id, id);
  }

  @Post("returns/:id/cancel")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.returnSchema })
  cancel(@CurrentUser() u: AuthUser, @Param("id", returnId) id: string) {
    return this.svc.cancel(u.id, id);
  }

  @Post("returns/:id/reschedule")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.returnSchema })
  reschedule(@CurrentUser() u: AuthUser, @Param("id", returnId) id: string, @Body({ schema: s.rescheduleBody }) body: z.infer<typeof s.rescheduleBody>) {
    return this.svc.reschedule(u.id, id, body.pickupDate, body.pickupSlot);
  }

  @Get("refunds")
  @ApiResponse({ status: 200, standardSchema: z.array(s.refundSchema) })
  refunds(@CurrentUser() u: AuthUser) {
    return this.svc.refunds(u.id);
  }

  @Get("returns/:id/photos/:photoId")
  @ApiProduces("image/png", "image/jpeg")
  async photo(@CurrentUser() u: AuthUser, @Param("id", returnId) id: string, @Param("photoId", uuidParam) photoId: string, @Res() res: Response) {
    sendFile(res, await this.svc.photo(id, photoId, { userId: u.id }));
  }

  @Post("uploads")
  @ApiConsumes("multipart/form-data")
  @ApiBody(photoSpec)
  @ApiResponse({ status: 201, standardSchema: s.uploadSchema })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: Upload) {
    return this.svc.upload(u.id, file);
  }
}

@ApiTags("Seller returns")
@ApiBearerAuth()
@SellerScoped()
@Controller("v1/seller/returns")
export class SellerReturnsController {
  constructor(@Inject(ReturnsService) private readonly svc: ReturnsService) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: z.array(s.returnSchema) })
  list(@CurrentSeller() sellerId: string, @Query({ schema: s.sellerListQuery }) q: z.infer<typeof s.sellerListQuery>) {
    return this.svc.sellerReturns(sellerId, q.status);
  }

  @Get(":id")
  @ApiResponse({ status: 200, standardSchema: s.returnSchema })
  get(@CurrentSeller() sellerId: string, @Param("id", returnId) id: string) {
    return this.svc.sellerReturn(sellerId, id);
  }

  @Post(":id/decision")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.returnSchema })
  decide(@CurrentSeller() sellerId: string, @Param("id", returnId) id: string, @Body({ schema: s.decisionBody }) body: z.infer<typeof s.decisionBody>) {
    return this.svc.decide(sellerId, id, body.approve, body.note);
  }

  @Post(":id/qc")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.returnSchema })
  qc(@CurrentSeller() sellerId: string, @Param("id", returnId) id: string, @Body({ schema: s.qcBody }) body: z.infer<typeof s.qcBody>) {
    return this.svc.qc(sellerId, id, body.pass, body.note);
  }

  @Get(":id/photos/:photoId")
  @ApiProduces("image/png", "image/jpeg")
  async photo(@CurrentSeller() sellerId: string, @Param("id", returnId) id: string, @Param("photoId", uuidParam) photoId: string, @Res() res: Response) {
    sendFile(res, await this.svc.photo(id, photoId, { sellerId }));
  }
}

@ApiTags("Development")
@ApiBearerAuth()
@Controller("v1/dev/returns")
export class DevReturnsController {
  constructor(@Inject(ReturnsService) private readonly svc: ReturnsService) {}

  /** Stands in for reverse pickup scans until phase 3. Disabled in production. */
  @Post(":id/advance")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.returnSchema })
  advance(@Param("id", returnId) id: string, @Body({ schema: s.advanceBody }) body: z.infer<typeof s.advanceBody>) {
    if (isProduction()) throw forbidden("Development endpoints are disabled in production");
    return this.svc.advance(id, body.to);
  }
}

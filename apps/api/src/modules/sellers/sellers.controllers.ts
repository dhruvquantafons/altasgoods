import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiResponse, ApiTags, type ApiBodyOptions } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { KYC_DOCUMENT_KINDS } from "../../db/schema.js";
import { CurrentUser, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import { OnboardingService } from "./onboarding.service.js";
import { ReviewService } from "./review.service.js";
import * as s from "./sellers.schemas.js";

const uuidParam = { schema: z.uuid() };
const appIdParam = { schema: z.string().regex(/^SA-\d+$/, "Application ids look like SA-50001") };

const uploadSpec: ApiBodyOptions = {
  schema: {
    type: "object",
    required: ["kind", "file"],
    properties: { kind: { type: "string", enum: [...KYC_DOCUMENT_KINDS] }, file: { type: "string", format: "binary", description: "PDF, PNG or JPG, up to 4 MB (signature: PNG or JPG, up to 1 MB)" } },
  },
};

type Upload = { originalname: string; buffer: Buffer; size: number } | undefined;

function sendFile(res: Response, file: { content: Buffer; mimeType: string; fileName: string }) {
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.content);
}

@ApiTags("Seller onboarding")
@ApiBearerAuth()
@Controller("v1/me/seller-application")
export class OnboardingController {
  constructor(@Inject(OnboardingService) private readonly svc: OnboardingService) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: s.applicationSchema })
  get(@CurrentUser() u: AuthUser) {
    return this.svc.get(u.id);
  }

  @Post()
  @ApiResponse({ status: 201, standardSchema: s.applicationSchema, description: "Started, or the existing application" })
  async start(@CurrentUser() u: AuthUser, @Res({ passthrough: true }) res: Response) {
    const r = await this.svc.start(u.id);
    res.status(r.created ? 201 : 200);
    return r.view;
  }

  @Patch()
  @ApiResponse({ status: 200, standardSchema: s.applicationSchema })
  update(@CurrentUser() u: AuthUser, @Body({ schema: s.updateApplicationBody }) body: z.infer<typeof s.updateApplicationBody>) {
    return this.svc.update(u.id, body);
  }

  @Post("verify/gstin")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.applicationSchema })
  verifyGstin(@CurrentUser() u: AuthUser, @Body({ schema: s.verifyGstinBody }) body: z.infer<typeof s.verifyGstinBody>) {
    return this.svc.verifyGstin(u.id, body.gstin);
  }

  @Post("verify/pan")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.applicationSchema })
  verifyPan(@CurrentUser() u: AuthUser, @Body({ schema: s.verifyPanBody }) body: z.infer<typeof s.verifyPanBody>) {
    return this.svc.verifyPan(u.id, body);
  }

  @Post("verify/bank")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.applicationSchema })
  verifyBank(@CurrentUser() u: AuthUser, @Body({ schema: s.verifyBankBody }) body: z.infer<typeof s.verifyBankBody>) {
    return this.svc.verifyBank(u.id, body);
  }

  @Get("store-name")
  @ApiResponse({ status: 200, standardSchema: s.storeNameSchema })
  storeName(@CurrentUser() u: AuthUser, @Query("name", { schema: s.storeNameQuery.name }) name: string) {
    return this.svc.storeName(u.id, name);
  }

  @Post("documents")
  @ApiConsumes("multipart/form-data")
  @ApiBody(uploadSpec)
  @ApiResponse({ status: 201, standardSchema: s.applicationSchema })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: Upload, @Body() body: unknown) {
    const parsed = s.uploadKind.safeParse(body);
    if (!parsed.success) throw new ApiError(422, "VALIDATION_FAILED", "Choose what this document is", [{ path: "kind", message: "Unknown document kind" }]);
    return this.svc.upload(u.id, parsed.data.kind, file);
  }

  @Get("documents/:id")
  @ApiProduces("application/pdf", "image/png", "image/jpeg")
  async document(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Res() res: Response) {
    sendFile(res, await this.svc.documentFile(u.id, id));
  }

  @Delete("documents/:id")
  @HttpCode(204)
  async removeDocument(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string) {
    await this.svc.removeDocument(u.id, id);
  }

  @Post("submit")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.applicationSchema })
  submit(@CurrentUser() u: AuthUser, @Body({ schema: s.submitBody }) _body: z.infer<typeof s.submitBody>) {
    return this.svc.submit(u.id);
  }
}

@ApiTags("Control: seller applications")
@ApiBearerAuth()
@StaffOnly("SELLER_VERIFIER", "RISK_ANALYST", "AUDITOR")
@Controller("v1/admin/seller-applications")
export class ReviewController {
  constructor(
    @Inject(ReviewService) private readonly svc: ReviewService,
    @Inject(OnboardingService) private readonly onboarding: OnboardingService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: s.reviewListSchema })
  list(@Query({ schema: s.listQuery }) query: z.infer<typeof s.listQuery>) {
    return this.svc.list(query);
  }

  @Get(":id")
  @ApiResponse({ status: 200, standardSchema: s.reviewSchema })
  detail(@Param("id", appIdParam) id: string) {
    return this.svc.detail(id);
  }

  @Get(":id/documents/:documentId")
  @ApiProduces("application/pdf", "image/png", "image/jpeg")
  async document(@Param("id", appIdParam) id: string, @Param("documentId", uuidParam) documentId: string, @Res() res: Response) {
    sendFile(res, await this.onboarding.fileOf(id, documentId));
  }

  @Post(":id/approve")
  @HttpCode(200)
  @StaffOnly("SELLER_VERIFIER")
  @ApiResponse({ status: 200, standardSchema: s.reviewSchema })
  approve(@CurrentUser() u: AuthUser, @Param("id", appIdParam) id: string, @Body({ schema: s.approveBody }) body: z.infer<typeof s.approveBody>) {
    return this.svc.approve(u.id, id, body.note);
  }

  @Post(":id/request-changes")
  @HttpCode(200)
  @StaffOnly("SELLER_VERIFIER")
  @ApiResponse({ status: 200, standardSchema: s.reviewSchema })
  requestChanges(@CurrentUser() u: AuthUser, @Param("id", appIdParam) id: string, @Body({ schema: s.requestChangesBody }) body: z.infer<typeof s.requestChangesBody>) {
    return this.svc.requestChanges(u.id, id, body);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @StaffOnly("SELLER_VERIFIER")
  @ApiResponse({ status: 200, standardSchema: s.reviewSchema })
  reject(@CurrentUser() u: AuthUser, @Param("id", appIdParam) id: string, @Body({ schema: s.rejectBody }) body: z.infer<typeof s.rejectBody>) {
    return this.svc.reject(u.id, id, body);
  }

  @Post(":id/reopen")
  @HttpCode(200)
  @StaffOnly("SELLER_VERIFIER")
  @ApiResponse({ status: 200, standardSchema: s.reviewSchema })
  reopen(@CurrentUser() u: AuthUser, @Param("id", appIdParam) id: string) {
    return this.svc.reopen(u.id, id);
  }
}

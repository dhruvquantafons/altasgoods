import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { CurrentUser, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import { exportKindParam, exportQuery, type ExportKind } from "./exports.schemas.js";
import { ExportsService } from "./exports.service.js";

@ApiTags("Admin")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN", "AUDITOR")
@Controller("v1/admin/exports")
export class AdminExportsController {
  constructor(@Inject(ExportsService) private readonly svc: ExportsService) {}

  /**
   * A CSV of orders, order-items, payments, refunds, customers or audit, with
   * the filters of the matching list page plus from and to (IST days). The
   * path may end in .csv. At most 50,000 rows: past that the file ends with a
   * note row and X-Export-Truncated is true.
   */
  @Get(":kind")
  @ApiProduces("text/csv")
  @ApiResponse({
    status: 200,
    description: "The CSV file (UTF-8 with a byte order mark, CRLF line endings, money in rupees, times in IST)",
    content: { "text/csv": { schema: { type: "string" } } },
    headers: { "X-Export-Truncated": { description: "true when the file stops at the row cap", schema: { type: "string" } } },
  })
  async export(@CurrentUser() u: AuthUser, @Param("kind", { schema: exportKindParam }) kind: ExportKind, @Query({ schema: exportQuery }) q: z.infer<typeof exportQuery>, @Res() res: Response) {
    await this.svc.stream(u, kind, q, res);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuditService, diff } from "../admin/audit.service.js";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import * as s from "./reviews.schemas.js";
import { ReviewsService } from "./reviews.service.js";

const reviewId = { schema: z.uuid() };

@ApiTags("Reviews")
@Controller("v1")
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly svc: ReviewsService) {}

  /** Published reviews. Signed in, it also says whether this customer can review the product. */
  @Public()
  @Get("products/:slug/reviews")
  @ApiResponse({ status: 200, standardSchema: s.productReviews })
  forProduct(@Param("slug", { schema: z.string().min(1).max(160) }) slug: string, @Query({ schema: s.productReviewsQuery }) q: z.infer<typeof s.productReviewsQuery>, @CurrentUser() u?: AuthUser) {
    return this.svc.forProduct(slug, q, u?.id);
  }

  @ApiBearerAuth()
  @Get("me/reviews")
  @ApiResponse({ status: 200, standardSchema: z.array(s.myReview) })
  mine(@CurrentUser() u: AuthUser) {
    return this.svc.mine(u.id);
  }

  @ApiBearerAuth()
  @Get("me/reviewable")
  @ApiResponse({ status: 200, standardSchema: s.reviewable })
  reviewable(@CurrentUser() u: AuthUser) {
    return this.svc.reviewable(u.id);
  }

  @ApiBearerAuth()
  @Post("me/reviews")
  @ApiResponse({ status: 201, standardSchema: s.myReview })
  create(@CurrentUser() u: AuthUser, @Body({ schema: s.reviewInput }) body: z.infer<typeof s.reviewInput>) {
    return this.svc.create(u.id, body);
  }

  @ApiBearerAuth()
  @Patch("me/reviews/:id")
  @ApiResponse({ status: 200, standardSchema: s.myReview })
  update(@CurrentUser() u: AuthUser, @Param("id", reviewId) id: string, @Body({ schema: s.reviewPatch }) body: z.infer<typeof s.reviewPatch>) {
    return this.svc.update(u.id, id, body);
  }

  @ApiBearerAuth()
  @Delete("me/reviews/:id")
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param("id", reviewId) id: string) {
    await this.svc.remove(u.id, id);
  }
}

@ApiTags("Admin reviews")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN", "CATALOG_MANAGER")
@Controller("v1/admin/reviews")
export class AdminReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly svc: ReviewsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: s.adminReviewList })
  list(@Query({ schema: s.adminReviewsQuery }) q: z.infer<typeof s.adminReviewsQuery>) {
    return this.svc.adminList(q);
  }

  @Patch(":id")
  @ApiResponse({ status: 200, standardSchema: s.adminReview })
  async moderate(@CurrentUser() u: AuthUser, @Param("id", reviewId) id: string, @Body({ schema: s.moderateBody }) body: z.infer<typeof s.moderateBody>) {
    const { before, review } = await this.svc.moderate(id, body);
    const changes = diff(before as unknown as Record<string, unknown>, review as unknown as Record<string, unknown>, Object.keys(body));
    const action = body.status && body.status !== before.status ? (body.status === "PUBLISHED" ? "review.publish" : "review.hide") : "review.update";
    const verb = action === "review.publish" ? "Published" : action === "review.hide" ? "Hid" : body.reply !== undefined ? "Replied to" : "Updated";
    if (Object.keys(changes).length) await this.audit.log(u, action, { type: "review", id }, `${verb} a ${before.rating} star review of ${review.product.title}`, changes);
    return review;
  }
}

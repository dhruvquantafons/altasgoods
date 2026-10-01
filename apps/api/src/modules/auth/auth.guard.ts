import { createParamDecorator, Inject, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ApiError, forbidden } from "../../common/errors.js";
import type { StaffRole } from "../../db/schema.js";
import { TokensService } from "./tokens.service.js";

export interface AuthUser {
  id: string;
  sessionId: string;
  sellers: string[];
  staff: string[];
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  sellerId?: string;
}

const PUBLIC = "auth:public";
const SELLER = "auth:seller";
const STAFF = "auth:staff";

/** Route needs no sign in. Everything else requires a valid access token. */
export const Public = () => SetMetadata(PUBLIC, true);
/** Route acts on behalf of a seller the user belongs to (X-Seller-Id header picks one). */
export const SellerScoped = () => SetMetadata(SELLER, true);
/** Route is for BluBuy staff holding one of these roles. SUPER_ADMIN passes every staff check. */
export const StaffOnly = (...roles: StaffRole[]) => SetMetadata(STAFF, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().user!);
export const CurrentSeller = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().sellerId!);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, targets);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (token) {
      try {
        const claims = await this.tokens.verify(token);
        req.user = { id: claims.sub, sessionId: claims.sid, sellers: claims.sellers, staff: claims.staff };
      } catch (e) {
        if (!isPublic) throw e;
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");

    if (this.reflector.getAllAndOverride<boolean>(SELLER, targets)) {
      const requested = req.headers["x-seller-id"];
      const sellerId = typeof requested === "string" ? requested : req.user.sellers[0];
      if (!sellerId || !req.user.sellers.includes(sellerId)) throw forbidden("You are not a member of this seller account.");
      req.sellerId = sellerId;
    }

    // method level roles override class level ones
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(STAFF, targets);
    if (roles && !req.user.staff.some((r) => r === "SUPER_ADMIN" || roles.includes(r as StaffRole))) {
      throw forbidden(req.user.staff.length ? "Your BluBuy Control role does not allow this action." : "This area is for BluBuy staff.");
    }
    return true;
  }
}

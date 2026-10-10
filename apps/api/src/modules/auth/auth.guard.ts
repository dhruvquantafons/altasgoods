import { createParamDecorator, Inject, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ApiError, forbidden } from "../../common/errors.js";
import type { StaffRole } from "../../db/schema.js";
import { TokensService } from "./tokens.service.js";

export interface AuthUser {
  id: string;
  sessionId: string;
  staff: string[];
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const PUBLIC = "auth:public";
const STAFF = "auth:staff";

/** Route needs no sign in. Everything else requires a valid access token. */
export const Public = () => SetMetadata(PUBLIC, true);
/** Route is for AltasGoods staff holding one of these roles. SUPER_ADMIN passes every staff check. */
export const StaffOnly = (...roles: StaffRole[]) => SetMetadata(STAFF, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().user!);

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
        req.user = { id: claims.sub, sessionId: claims.sid, staff: claims.staff };
      } catch (e) {
        if (!isPublic) throw e;
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");

    // method level roles override class level ones
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(STAFF, targets);
    if (roles && !req.user.staff.some((r) => r === "SUPER_ADMIN" || roles.includes(r as StaffRole))) {
      throw forbidden(req.user.staff.length ? "Your AltasGoods Control role does not allow this action." : "This area is for AltasGoods staff.");
    }
    return true;
  }
}

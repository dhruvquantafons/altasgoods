import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

/**
 * Domain error with a stable machine-readable code. Rendered as RFC 7807
 * problem details: { type, title, status, code, detail, errors? }.
 */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly errors?: { path: string; message: string }[],
  ) {
    super(message, status);
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found`);
export const forbidden = (message = "You do not have access to this resource") => new ApiError(403, "FORBIDDEN", message);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const unprocessable = (code: string, message: string) => new ApiError(422, code, message);

const titles: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  422: "Validation failed",
  429: "Too many requests",
  500: "Internal server error",
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Errors");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL";
    let detail = "Something went wrong. Please try again.";
    let errors: { path: string; message: string }[] | undefined;

    if (exception instanceof ApiError) {
      status = exception.getStatus();
      code = exception.code;
      detail = exception.message;
      errors = exception.errors;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = status === 400 || status === 422 ? "VALIDATION_FAILED" : HttpStatus[status] ?? "HTTP_ERROR";
      if (typeof body === "object" && body && "message" in body) {
        const m = (body as { message: unknown }).message;
        if (Array.isArray(m)) {
          errors = m.map((x) => {
            const s = String(x);
            const idx = s.indexOf(": ");
            return idx > 0 ? { path: s.slice(0, idx), message: s.slice(idx + 2) } : { path: "", message: s };
          });
          detail = "Some fields are invalid";
          status = 422;
        } else detail = String(m);
      } else if (typeof body === "string") detail = body;
    } else {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    }

    res
      .status(status)
      .type("application/problem+json")
      .json({ type: `https://docs.altasgoods.in/errors/${code.toLowerCase()}`, title: titles[status] ?? "Error", status, code, detail, ...(errors ? { errors } : {}) });
  }
}

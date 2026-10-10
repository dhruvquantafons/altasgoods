import "reflect-metadata";
import { StandardSchemaValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { env } from "./config/env.js";
import { ProblemDetailsFilter } from "./common/errors.js";
import { AppModule } from "./app.module.js";

/** Applies the global HTTP setup shared by the server, tests and the OpenAPI export. */
export function configureApp(app: INestApplication) {
  app.enableCors({ origin: [env().WEB_ORIGIN], credentials: true, allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"] });
  app.useGlobalPipes(new StandardSchemaValidationPipe({ errorHttpStatusCode: 422 }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  return app;
}

export async function createApp(options: { logger?: false } = {}) {
  const app = await NestFactory.create(AppModule, { ...options, rawBody: true });
  return configureApp(app);
}

export function openApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("BluBuy API")
    .setDescription("Marketplace API for the BluBuy web and mobile apps. Money is in paise (1 rupee = 100 paise).")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

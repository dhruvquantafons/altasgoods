import { Logger } from "@nestjs/common";
import { SwaggerModule } from "@nestjs/swagger";
import { env } from "./config/env.js";
import { createApp, openApiDocument } from "./app.js";

const app = await createApp();
SwaggerModule.setup("docs", app, () => openApiDocument(app));
await app.listen(env().PORT);
Logger.log(`BluBuy API on http://localhost:${env().PORT} (docs at /docs)`, "Bootstrap");

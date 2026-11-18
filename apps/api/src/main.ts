import { Logger } from "@nestjs/common";
import { SwaggerModule } from "@nestjs/swagger";
import { devToolsEnabled, env, isProduction } from "./config/env.js";
import { createApp, openApiDocument } from "./app.js";

const app = await createApp();
SwaggerModule.setup("docs", app, () => openApiDocument(app));
await app.listen(env().PORT);
Logger.log(`AltasGoods API on http://localhost:${env().PORT} (docs at /docs)`, "Bootstrap");
if (!isProduction()) {
  Logger.warn(`NODE_ENV is "${env().NODE_ENV}", not production. Development endpoints are enabled${devToolsEnabled() ? " and sign-in codes are returned in API responses" : ""}. Never run a live store like this.`, "Bootstrap");
}

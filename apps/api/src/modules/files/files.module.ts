import { Global, Module } from "@nestjs/common";
import { FILE_STORE } from "../../common/tokens.js";
import { PostgresFileStore } from "./file-store.js";

/** The file store, shared by onboarding documents and support attachments. */
@Global()
@Module({
  providers: [{ provide: FILE_STORE, useClass: PostgresFileStore }],
  exports: [FILE_STORE],
})
export class FilesModule {}

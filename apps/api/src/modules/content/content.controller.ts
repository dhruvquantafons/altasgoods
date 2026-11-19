import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import { AuditService, diff } from "../admin/audit.service.js";
import * as c from "./content.schemas.js";
import { ContentService } from "./content.service.js";

const slugParam = { schema: z.string().min(1).max(80) };
const idParam = { schema: z.string().min(1).max(64) };
const uuidParam = { schema: z.uuid() };

/** Changed fields for the audit log. Long text is summarised rather than copied into the log. */
function changed(before: object, after: object, keys: string[]) {
  const squash = (o: Record<string, unknown>) => ({ ...o, ...(Array.isArray(o.sections) ? { sections: `${o.sections.length} sections, ${o.sections.reduce((n: number, s: { body: string }) => n + s.body.length, 0)} characters` } : {}) });
  const out = diff(before as Record<string, unknown>, after as Record<string, unknown>, keys);
  // sections: compare the full text, report the summary
  if (out.sections) out.sections = [squash(before as Record<string, unknown>).sections, squash(after as Record<string, unknown>).sections];
  return out;
}

@ApiTags("Admin content")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN", "CATALOG_MANAGER")
@Controller("v1/admin/content")
export class AdminContentController {
  constructor(
    @Inject(ContentService) private readonly svc: ContentService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /* Pages and policies */

  @StaffOnly("OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR")
  @Get("pages")
  @ApiResponse({ status: 200, standardSchema: z.array(c.pageSchema) })
  pages() {
    return this.svc.listPages();
  }

  @Post("pages")
  @ApiResponse({ status: 201, standardSchema: c.pageSchema })
  async createPage(@CurrentUser() u: AuthUser, @Body({ schema: c.pageInput }) body: z.infer<typeof c.pageInput>) {
    const p = await this.svc.createPage(body, u.id);
    await this.audit.log(u, "content.page.create", { type: "content_page", id: p.slug }, `Added the page "${p.title}"`);
    return p;
  }

  @Post("pages/reorder")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.array(c.pageSchema) })
  async reorderPages(@CurrentUser() u: AuthUser, @Body({ schema: c.slugOrder }) body: z.infer<typeof c.slugOrder>) {
    const list = await this.svc.reorderPages(body.slugs);
    await this.audit.log(u, "content.page.reorder", { type: "content_page" }, "Reordered the pages and policies");
    return list;
  }

  @Patch("pages/:slug")
  @ApiResponse({ status: 200, standardSchema: c.pageSchema })
  async updatePage(@CurrentUser() u: AuthUser, @Param("slug", slugParam) slug: string, @Body({ schema: c.pagePatch }) body: z.infer<typeof c.pagePatch>) {
    const { before, after } = await this.svc.updatePage(slug, body, u.id);
    const changes = changed(before, after, Object.keys(body));
    if (Object.keys(changes).length) await this.audit.log(u, "content.page.update", { type: "content_page", id: slug }, `Edited the page "${after.title}"`, changes);
    return after;
  }

  @Delete("pages/:slug")
  @HttpCode(204)
  async removePage(@CurrentUser() u: AuthUser, @Param("slug", slugParam) slug: string) {
    const p = await this.svc.removePage(slug);
    await this.audit.log(u, "content.page.delete", { type: "content_page", id: slug }, `Deleted the page "${p.title}"`);
  }

  /* FAQs */

  @StaffOnly("OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR")
  @Get("faqs")
  @ApiResponse({ status: 200, standardSchema: z.array(c.faqSchema) })
  faqs() {
    return this.svc.listFaqs();
  }

  @Post("faqs")
  @ApiResponse({ status: 201, standardSchema: c.faqSchema })
  async createFaq(@CurrentUser() u: AuthUser, @Body({ schema: c.faqInput }) body: z.infer<typeof c.faqInput>) {
    const f = await this.svc.createFaq(body);
    await this.audit.log(u, "content.faq.create", { type: "faq", id: f.id }, `Added the question "${f.q}"`);
    return f;
  }

  @Post("faqs/reorder")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.array(c.faqSchema) })
  async reorderFaqs(@CurrentUser() u: AuthUser, @Body({ schema: c.idOrder }) body: z.infer<typeof c.idOrder>) {
    const list = await this.svc.reorderFaqs(body.ids);
    await this.audit.log(u, "content.faq.reorder", { type: "faq" }, "Reordered the help questions");
    return list;
  }

  @Patch("faqs/:id")
  @ApiResponse({ status: 200, standardSchema: c.faqSchema })
  async updateFaq(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string, @Body({ schema: c.faqPatch }) body: z.infer<typeof c.faqPatch>) {
    const { before, after } = await this.svc.updateFaq(id, body);
    const changes = diff(before, after, Object.keys(body) as (keyof typeof before)[]);
    if (Object.keys(changes).length) await this.audit.log(u, "content.faq.update", { type: "faq", id }, `Edited the question "${after.q}"`, changes);
    return after;
  }

  @Delete("faqs/:id")
  @HttpCode(204)
  async removeFaq(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string) {
    const f = await this.svc.removeFaq(id);
    await this.audit.log(u, "content.faq.delete", { type: "faq", id }, `Removed the question "${f.q}"`);
  }

  /* Help topics */

  @StaffOnly("OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR")
  @Get("help-topics")
  @ApiResponse({ status: 200, standardSchema: z.array(c.topicSchema) })
  topics() {
    return this.svc.listTopics();
  }

  @Post("help-topics")
  @ApiResponse({ status: 201, standardSchema: c.topicSchema })
  async createTopic(@CurrentUser() u: AuthUser, @Body({ schema: c.topicInput }) body: z.infer<typeof c.topicInput>) {
    const t = await this.svc.createTopic(body);
    await this.audit.log(u, "content.help_topic.create", { type: "help_topic", id: t.id }, `Added the help topic "${t.title}"`);
    return t;
  }

  @Post("help-topics/reorder")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.array(c.topicSchema) })
  async reorderTopics(@CurrentUser() u: AuthUser, @Body({ schema: c.idOrder }) body: z.infer<typeof c.idOrder>) {
    const list = await this.svc.reorderTopics(body.ids);
    await this.audit.log(u, "content.help_topic.reorder", { type: "help_topic" }, "Reordered the help topics");
    return list;
  }

  @Patch("help-topics/:id")
  @ApiResponse({ status: 200, standardSchema: c.topicSchema })
  async updateTopic(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string, @Body({ schema: c.topicPatch }) body: z.infer<typeof c.topicPatch>) {
    const { before, after } = await this.svc.updateTopic(id, body);
    const changes = diff(before, after, Object.keys(body) as (keyof typeof before)[]);
    if (Object.keys(changes).length) await this.audit.log(u, "content.help_topic.update", { type: "help_topic", id }, `Edited the help topic "${after.title}"`, changes);
    return after;
  }

  @Delete("help-topics/:id")
  @HttpCode(204)
  async removeTopic(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string) {
    const t = await this.svc.removeTopic(id);
    await this.audit.log(u, "content.help_topic.delete", { type: "help_topic", id }, `Removed the help topic "${t.title}"`);
  }

  /* Careers */

  @StaffOnly("OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR")
  @Get("roles")
  @ApiResponse({ status: 200, standardSchema: z.array(c.roleSchema) })
  roles() {
    return this.svc.listRoles();
  }

  @Post("roles")
  @ApiResponse({ status: 201, standardSchema: c.roleSchema })
  async createRole(@CurrentUser() u: AuthUser, @Body({ schema: c.roleInput }) body: z.infer<typeof c.roleInput>) {
    const r = await this.svc.createRole(body);
    await this.audit.log(u, "content.role.create", { type: "job_role", id: r.slug }, `Added the role "${r.title}"`);
    return r;
  }

  @Post("roles/reorder")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.array(c.roleSchema) })
  async reorderRoles(@CurrentUser() u: AuthUser, @Body({ schema: c.slugOrder }) body: z.infer<typeof c.slugOrder>) {
    const list = await this.svc.reorderRoles(body.slugs);
    await this.audit.log(u, "content.role.reorder", { type: "job_role" }, "Reordered the open roles");
    return list;
  }

  @Patch("roles/:slug")
  @ApiResponse({ status: 200, standardSchema: c.roleSchema })
  async updateRole(@CurrentUser() u: AuthUser, @Param("slug", slugParam) slug: string, @Body({ schema: c.rolePatch }) body: z.infer<typeof c.rolePatch>) {
    const { before, after } = await this.svc.updateRole(slug, body);
    const changes = diff(before, after, Object.keys(body) as (keyof typeof before)[]);
    if (Object.keys(changes).length) await this.audit.log(u, "content.role.update", { type: "job_role", id: slug }, `Edited the role "${after.title}"`, changes);
    return after;
  }

  @Delete("roles/:slug")
  @HttpCode(204)
  async removeRole(@CurrentUser() u: AuthUser, @Param("slug", slugParam) slug: string) {
    const r = await this.svc.removeRole(slug);
    await this.audit.log(u, "content.role.delete", { type: "job_role", id: slug }, `Removed the role "${r.title}"`);
  }

  /* Press */

  @StaffOnly("OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR")
  @Get("press")
  @ApiResponse({ status: 200, standardSchema: z.array(c.pressSchema) })
  press() {
    return this.svc.listPress();
  }

  @Post("press")
  @ApiResponse({ status: 201, standardSchema: c.pressSchema })
  async createPress(@CurrentUser() u: AuthUser, @Body({ schema: c.pressInput }) body: z.infer<typeof c.pressInput>) {
    const r = await this.svc.createPress(body);
    await this.audit.log(u, "content.press.create", { type: "press_release", id: r.slug }, `Added the press release "${r.title}"`);
    return r;
  }

  @Post("press/reorder")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.array(c.pressSchema) })
  async reorderPress(@CurrentUser() u: AuthUser, @Body({ schema: c.slugOrder }) body: z.infer<typeof c.slugOrder>) {
    const list = await this.svc.reorderPress(body.slugs);
    await this.audit.log(u, "content.press.reorder", { type: "press_release" }, "Reordered the press releases");
    return list;
  }

  @Patch("press/:slug")
  @ApiResponse({ status: 200, standardSchema: c.pressSchema })
  async updatePress(@CurrentUser() u: AuthUser, @Param("slug", slugParam) slug: string, @Body({ schema: c.pressPatch }) body: z.infer<typeof c.pressPatch>) {
    const { before, after } = await this.svc.updatePress(slug, body);
    const changes = diff(before, after, Object.keys(body) as (keyof typeof before)[]);
    if (Object.keys(changes).length) await this.audit.log(u, "content.press.update", { type: "press_release", id: slug }, `Edited the press release "${after.title}"`, changes);
    return after;
  }

  @Delete("press/:slug")
  @HttpCode(204)
  async removePress(@CurrentUser() u: AuthUser, @Param("slug", slugParam) slug: string) {
    const r = await this.svc.removePress(slug);
    await this.audit.log(u, "content.press.delete", { type: "press_release", id: slug }, `Removed the press release "${r.title}"`);
  }

  /* About */

  @StaffOnly("OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR")
  @Get("about")
  @ApiResponse({ status: 200, standardSchema: c.aboutSchema })
  about() {
    return this.svc.getAbout();
  }

  @Put("about")
  @ApiResponse({ status: 200, standardSchema: c.aboutSchema })
  async saveAbout(@CurrentUser() u: AuthUser, @Body({ schema: c.aboutDoc }) body: z.infer<typeof c.aboutDoc>) {
    const { before, after } = await this.svc.saveAbout(body, u.id);
    const count = (k: "numbers" | "principles" | "milestones" | "offices") => `${before[k].length} to ${after[k].length}`;
    const changes = diff(before, after, ["numbers", "principles", "milestones", "offices"]);
    if (Object.keys(changes).length) await this.audit.log(u, "content.about.update", { type: "about", id: "about" }, `Edited the About page (numbers ${count("numbers")}, principles ${count("principles")}, milestones ${count("milestones")}, offices ${count("offices")})`, changes);
    return after;
  }

  /* Brand spotlights */

  @StaffOnly("OPS_ADMIN", "CATALOG_MANAGER", "AUDITOR")
  @Get("spotlights")
  @ApiResponse({ status: 200, standardSchema: z.array(c.spotlightSchema) })
  spotlights() {
    return this.svc.listSpotlights();
  }

  @Post("spotlights")
  @ApiResponse({ status: 201, standardSchema: c.spotlightSchema })
  async createSpotlight(@CurrentUser() u: AuthUser, @Body({ schema: c.spotlightInput }) body: z.infer<typeof c.spotlightInput>) {
    const s = await this.svc.createSpotlight(body);
    await this.audit.log(u, "content.spotlight.create", { type: "brand_spotlight", id: s.id }, `Added the brand spotlight "${s.brand}"`);
    return s;
  }

  @Post("spotlights/reorder")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.array(c.spotlightSchema) })
  async reorderSpotlights(@CurrentUser() u: AuthUser, @Body({ schema: c.uuidOrder }) body: z.infer<typeof c.uuidOrder>) {
    const list = await this.svc.reorderSpotlights(body.ids);
    await this.audit.log(u, "content.spotlight.reorder", { type: "brand_spotlight" }, "Reordered the brand spotlights");
    return list;
  }

  @Patch("spotlights/:id")
  @ApiResponse({ status: 200, standardSchema: c.spotlightSchema })
  async updateSpotlight(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: c.spotlightPatch }) body: z.infer<typeof c.spotlightPatch>) {
    const { before, after } = await this.svc.updateSpotlight(id, body);
    const changes = diff(before, after, Object.keys(body) as (keyof typeof before)[]);
    if (Object.keys(changes).length) await this.audit.log(u, "content.spotlight.update", { type: "brand_spotlight", id }, `Edited the brand spotlight "${after.brand}"`, changes);
    return after;
  }

  @Delete("spotlights/:id")
  @HttpCode(204)
  async removeSpotlight(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string) {
    const s = await this.svc.removeSpotlight(id);
    await this.audit.log(u, "content.spotlight.delete", { type: "brand_spotlight", id }, `Removed the brand spotlight "${s.brand}"`);
  }
}

@ApiTags("Storefront")
@Controller("v1/storefront/content")
export class StorefrontContentController {
  constructor(@Inject(ContentService) private readonly svc: ContentService) {}

  /** Published policies, in order. */
  @Public()
  @Get("policies")
  @ApiResponse({ status: 200, standardSchema: z.array(c.storefrontPageCard) })
  policies() {
    return this.svc.storefrontPolicies();
  }

  @Public()
  @Get("policies/:slug")
  @ApiResponse({ status: 200, standardSchema: c.storefrontPage })
  policy(@Param("slug", slugParam) slug: string) {
    return this.svc.storefrontPolicy(slug);
  }

  @Public()
  @Get("help")
  @ApiResponse({ status: 200, standardSchema: c.storefrontHelp })
  help() {
    return this.svc.storefrontHelp();
  }

  @Public()
  @Get("careers")
  @ApiResponse({ status: 200, standardSchema: z.array(c.storefrontRole) })
  careers() {
    return this.svc.storefrontRoles();
  }

  @Public()
  @Get("careers/:slug")
  @ApiResponse({ status: 200, standardSchema: c.storefrontRole })
  role(@Param("slug", slugParam) slug: string) {
    return this.svc.storefrontRole(slug);
  }

  @Public()
  @Get("press")
  @ApiResponse({ status: 200, standardSchema: z.array(c.storefrontPress) })
  press() {
    return this.svc.storefrontPress();
  }

  @Public()
  @Get("about")
  @ApiResponse({ status: 200, standardSchema: c.aboutSchema })
  about() {
    return this.svc.getAbout();
  }

  /** Homepage brand spotlights whose product is on sale. */
  @Public()
  @Get("brand-spotlights")
  @ApiResponse({ status: 200, standardSchema: z.array(c.storefrontSpotlight) })
  spotlights() {
    return this.svc.storefrontSpotlights();
  }
}

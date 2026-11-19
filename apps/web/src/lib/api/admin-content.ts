import "server-only";
import { api, unwrap } from "./server";
import type { paths } from "./schema";

type Get<P extends keyof paths> = paths[P] extends { get: { responses: { 200: { content: { "application/json": infer T } } } } } ? T : never;

export type ContentPage = Get<"/v1/admin/content/pages">[number];
export type ContentFaq = Get<"/v1/admin/content/faqs">[number];
export type ContentTopic = Get<"/v1/admin/content/help-topics">[number];
export type ContentRole = Get<"/v1/admin/content/roles">[number];
export type ContentPress = Get<"/v1/admin/content/press">[number];
export type ContentAbout = Get<"/v1/admin/content/about">;
export type ContentSpotlight = Get<"/v1/admin/content/spotlights">[number];

export const loadContentPages = async () => unwrap(await (await api()).GET("/v1/admin/content/pages"));
export const loadContentFaqs = async () => unwrap(await (await api()).GET("/v1/admin/content/faqs"));
export const loadContentTopics = async () => unwrap(await (await api()).GET("/v1/admin/content/help-topics"));
export const loadContentRoles = async () => unwrap(await (await api()).GET("/v1/admin/content/roles"));
export const loadContentPress = async () => unwrap(await (await api()).GET("/v1/admin/content/press"));
export const loadContentAbout = async () => unwrap(await (await api()).GET("/v1/admin/content/about"));
export const loadContentSpotlights = async () => unwrap(await (await api()).GET("/v1/admin/content/spotlights"));

import Link from "next/link";
import type { ComponentProps } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Same-site paths ("/policies/returns"), as opposed to "//host" or a full address. */
const isInternal = (href: string) => href.startsWith("/") && !href.startsWith("//");

const components: Components = {
  p: (props) => <p className="text-[15px] leading-relaxed text-ink-700" {...strip(props)} />,
  h3: (props) => <h3 className="mt-2 text-base font-semibold text-ink-900" {...strip(props)} />,
  h4: (props) => <h4 className="mt-1 text-[15px] font-semibold text-ink-900" {...strip(props)} />,
  strong: (props) => <strong className="font-semibold text-ink-900" {...strip(props)} />,
  ul: (props) => <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-ink-700 marker:text-brand-500" {...strip(props)} />,
  ol: (props) => <ol className="flex list-decimal flex-col gap-3 pl-5 text-[15px] leading-relaxed text-ink-700 marker:font-semibold marker:text-brand-700" {...strip(props)} />,
  li: (props) => <li className="pl-1" {...strip(props)} />,
  blockquote: (props) => <blockquote className="rounded-xl bg-brand-50/70 p-4 text-sm leading-relaxed text-ink-700 [&>p]:text-sm" {...strip(props)} />,
  hr: () => <hr className="border-line" />,
  table: (props) => (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm" {...strip(props)} />
    </div>
  ),
  thead: (props) => <thead className="bg-ink-50 text-xs text-ink-500" {...strip(props)} />,
  tbody: (props) => <tbody className="divide-y divide-line" {...strip(props)} />,
  th: (props) => <th className="px-4 py-2.5 font-medium" {...strip(props)} />,
  td: (props) => <td className="px-4 py-3 text-ink-800" {...strip(props)} />,
  code: (props) => <code className="rounded bg-ink-50 px-1 py-0.5 font-mono text-[13px]" {...strip(props)} />,
  a: ({ href, children }) => {
    const cls = "font-medium text-brand-700 underline-offset-2 hover:underline";
    if (!href) return <>{children}</>;
    if (isInternal(href)) return <Link href={href} className={cls}>{children}</Link>;
    if (href.startsWith("#")) return <a href={href} className={cls}>{children}</a>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  },
};

/** react-markdown passes the syntax tree node along; it is not a DOM attribute. */
function strip<T extends { node?: unknown }>(props: T) {
  const rest: Partial<T> = { ...props };
  delete rest.node;
  return rest as Omit<T, "node">;
}

/**
 * Markdown from the Content editor (AltasGoods Control), with GitHub-style tables. Raw HTML is never
 * rendered: it shows as plain text. Images are not allowed, and only http(s), mailto and relative links work.
 */
export function Prose({ markdown, className, ...rest }: { markdown: string } & Omit<ComponentProps<"div">, "children">) {
  return (
    <div className={cn("flex flex-col gap-4", className)} {...rest}>
      <Markdown remarkPlugins={[remarkGfm]} components={components} disallowedElements={["img", "h1", "h2"]} unwrapDisallowed>
        {markdown}
      </Markdown>
    </div>
  );
}

import type { ReactNode } from "react";
import Image from "@/features/articles/ArticleCover";
import { safeArticleUrl } from "./article-api";
import s from "./articles.module.css";
export function articleHeadings(source: string) {
  let code = false;
  return source.split(/\r?\n/).flatMap((line, i) => {
    if (line.startsWith("```")) {
      code = !code;
      return [];
    }
    const m = !code && /^(#{1,3})\s+(.+)$/.exec(line);
    return m ? [{ id: "section-" + i, title: m[2], level: m[1].length }] : [];
  });
}
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={i}>{part.slice(1, -1)}</code>;
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) {
        let href: string | null = null;
        if (/^\/(?!\/)/.test(link[2]) && !/[\\\u0000-\u001f]/.test(link[2]))
          href = link[2];
        else href = safeArticleUrl(link[2]);
        return href ? (
          <a key={i} href={href} rel="noopener noreferrer">
            {link[1]}
          </a>
        ) : (
          <span key={i}>{link[1]}</span>
        );
      }
      return part; // React text nodes escape all raw HTML; no HTML parser/evaluation.
    });
}
export default function ArticleMarkdown({ source }: { source: string }) {
  const lines = source.split(/\r?\n/),
    nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith("```")) {
      const code = [];
      while (++i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i]);
      nodes.push(
        <pre key={i}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const props = { id: "section-" + i, children: inline(heading[2]) };
      nodes.push(
        heading[1].length === 3 ? (
          <h3 key={i} {...props} />
        ) : (
          <h2 key={i} {...props} />
        ),
      );
      continue;
    }
    const image = /^!\[([^\]]*)\]\(([^\s)]+)\)$/.exec(line);
    if (image) {
      const url = safeArticleUrl(image[2]);
      if (url)
        nodes.push(
          <figure key={i}>
            <Image
              src={url}
              alt={image[1]}
              width={960}
              height={640}
              sizes="(max-width:768px) 90vw, 760px"
              className={s.bodyImage}
            />
            {image[1] && <figcaption>{image[1]}</figcaption>}
          </figure>,
        );
      continue;
    }
    if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const ordered = /^\d+\.\s/.test(line),
        items = [];
      while (
        i < lines.length &&
        (ordered ? /^\d+\.\s/ : /^[-*]\s/).test(lines[i])
      ) {
        items.push(
          <li key={i}>
            {inline(lines[i].replace(ordered ? /^\d+\.\s/ : /^[-*]\s/, ""))}
          </li>,
        );
        i++;
      }
      i--;
      nodes.push(ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>);
      continue;
    }
    if (line.startsWith("> ")) {
      nodes.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);
      continue;
    }
    const para = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^(#|>|```|[-*]\s|\d+\.\s|!\[)/.test(lines[i + 1])
    )
      para.push(lines[++i]);
    nodes.push(<p key={i}>{inline(para.join("\n"))}</p>);
  }
  return <div className={s.prose}>{nodes}</div>;
}

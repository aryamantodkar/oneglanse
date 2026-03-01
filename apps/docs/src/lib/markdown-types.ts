export type MarkdownNode =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string };

export type CodeToken = {
  value: string;
  className: string;
};

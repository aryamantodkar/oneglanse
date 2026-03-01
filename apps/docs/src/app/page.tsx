import { redirect } from "next/navigation";
import { DEFAULT_DOC_SLUG } from "@/lib/docs-index";

export default function DocsHome(): never {
  redirect(`/${DEFAULT_DOC_SLUG}`);
}

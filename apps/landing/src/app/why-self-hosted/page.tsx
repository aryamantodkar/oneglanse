import { ContentShell } from "@/components/content/content-shell";
import {
	WhySelfHostedArticle,
	whySelfHostedIntro,
	whySelfHostedTitle,
} from "@/components/content/why-self-hosted-article";
import { contentMetadata } from "@/lib/content-metadata";

export const metadata = contentMetadata(
	whySelfHostedTitle,
	"Why OneGlanse runs locally or on your infrastructure: collecting AI product responses through authenticated browsers is costly to operate at scale.",
	"/why-self-hosted",
);

export default function WhySelfHostedPage(): React.JSX.Element {
	return (
		<ContentShell title={whySelfHostedTitle} intro={whySelfHostedIntro}>
			<WhySelfHostedArticle />
		</ContentShell>
	);
}

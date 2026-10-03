import { ContentShell } from "@/components/content/content-shell";
import {
	WhyCamoufoxArticle,
	whyCamoufoxIntro,
	whyCamoufoxTitle,
} from "@/components/content/why-camoufox-article";
import { contentMetadata } from "@/lib/content-metadata";

export const metadata = contentMetadata(
	whyCamoufoxTitle,
	"The engineering history behind OneGlanse's move from custom Chromium fingerprinting to Camoufox for browser-based AI product collection.",
	"/why-camoufox",
);

export default function WhyCamoufoxPage(): React.JSX.Element {
	return (
		<ContentShell title={whyCamoufoxTitle} intro={whyCamoufoxIntro}>
			<WhyCamoufoxArticle />
		</ContentShell>
	);
}

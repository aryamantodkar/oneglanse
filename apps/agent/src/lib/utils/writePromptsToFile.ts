import fs from "node:fs";
import path from "node:path";

export function writePromptResult(runDir: string, index: number, data: any) {
	const filePath = path.join(runDir, `prompt-${index + 1}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

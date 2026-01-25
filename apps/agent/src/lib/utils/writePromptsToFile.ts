import path from "path";
import fs from "fs";

export function writePromptResult(runDir: string, index: number, data: any) {
    const filePath = path.join(runDir, `prompt-${index + 1}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
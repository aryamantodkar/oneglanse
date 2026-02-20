export function formatWorkspaceJoinCode(
	orgCode: string,
	workspaceCode: string,
) {
	return `${orgCode}/${workspaceCode}`;
}

export function parseWorkspaceJoinCode(code: string) {
	const trimmed = code.trim();
	if (!trimmed) return null;

	const parts = trimmed
		.split(/[/:]/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length !== 2) return null;

	return { orgCode: parts[0]!, workspaceCode: parts[1]! };
}

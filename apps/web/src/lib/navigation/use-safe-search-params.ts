"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function useSafeSearchParams(): URLSearchParams {
	const searchParams = useSearchParams();

	return useMemo(
		() => searchParams ?? new URLSearchParams(),
		[searchParams],
	);
}

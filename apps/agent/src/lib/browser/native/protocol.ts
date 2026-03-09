export const ONESCOPE_NATIVE_HOST_NAME = "ai.onescope.host";
export const ONESCOPE_EXTENSION_KEY =
	"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsv6cuYqI5L/aLvhi9bovPnjfNtoSIGZ+w9lzs+cq5vU6gFk9wvwK9O89dC3bYOawKScrd4z6+4Ts8WP6oITnJaucvpoLc/Rv1MuajAXaOraYEvByRyoDYbo7NOLZBVhhXosy1JzjaQP0p/XFOeziVhOlPutKVhDWt8aDd9nDPa3/N6UrOEstwkd12YeB6mpgOgCymM+FNriFim2WoW9tuuLMiPOzC5X/cY/75grApBnI6xr7rYGLEcA8oduv1Ue5Vdriuj0YR69GE9IVJdrOuWRhIgK5OavFftovzupUGKMyi7550wlmicV5eyrFh5nPaGAJtmDA2sbHEDzuT8D9rQIDAQAB";
export const ONESCOPE_EXTENSION_ID = "kmnkgihdlbjfeaelnjmdkoadakimcoge";
export const ONESCOPE_NATIVE_PORT_ENV = "ONESCOPE_NATIVE_PORT";

export type NativeRequest = {
	kind: "request";
	requestId: string;
	method: string;
	params?: unknown;
};

export type NativeResponse = {
	kind: "response";
	requestId: string;
	ok: boolean;
	result?: unknown;
	error?: string;
};

export type NativeEvent = {
	kind: "event";
	event: string;
	payload?: unknown;
};

export type NativeEnvelope = NativeRequest | NativeResponse | NativeEvent;

export function isNativeEnvelope(value: unknown): value is NativeEnvelope {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<NativeEnvelope>;
	return (
		candidate.kind === "request" ||
		candidate.kind === "response" ||
		candidate.kind === "event"
	);
}

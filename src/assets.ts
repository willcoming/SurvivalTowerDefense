/** Resolve public artwork under the same base path as the built application. */
export const assetUrl = (path: string) => `${import.meta.env?.BASE_URL ?? '/'}assets/${path}`;

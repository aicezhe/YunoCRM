/** Uniform return shape for server actions the client shows errors from.
 * The error string is already translated — actions run on the server, where
 * getTranslations knows the caller's locale. */
export type ActionResult = { ok: true } | { ok: false; error: string };

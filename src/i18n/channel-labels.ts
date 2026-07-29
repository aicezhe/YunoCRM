/**
 * Channel display names, translated. The DB enum value (e.g.
 * "linkedin_outbound") is never touched — only what's shown for it — so
 * queries and filters that compare against the enum keep working exactly
 * as before.
 *
 * `t` is whatever a component already has: useTranslations("channels") on
 * the client, getTranslations("channels") on the server. Falls back to the
 * raw enum value for anything not in the dictionary, matching every call
 * site's prior `CHANNEL_LABELS[x] ?? x` behavior.
 */
export function channelLabel(t: (key: string) => string, channel: string | null | undefined): string {
  if (!channel) return "";
  try {
    return t(channel);
  } catch {
    return channel;
  }
}

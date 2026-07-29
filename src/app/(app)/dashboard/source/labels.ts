/** Fixed per channel (not per rank), so a channel keeps the same shade
 * regardless of where it lands in the conversion-sorted list. */
export const CHANNEL_COLORS: Record<string, string> = {
  website: "#4B3FE0",
  linkedin_outbound: "#5B4FE9",
  referral: "#8B7FEE",
  event: "#B3A9F5",
  content_inbound: "#DAD4FB",
};

/** UTM sources aren't a fixed enum, so this is assigned by position. */
export const UTM_COLORS = ["#4B3FE0", "#5B4FE9", "#8B7FEE", "#B3A9F5", "#DAD4FB", "#EDE9FC"];

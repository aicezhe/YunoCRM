"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { channelLabel } from "@/i18n/channel-labels";
import { ChannelDonut } from "./channel-donut";
import { UtmDonut } from "./utm-donut";
import { SegmentPanel } from "./segment-panel";
import type { ChannelRow, UtmRow } from "./queries";
import type { Segment } from "./segment-queries";

/** Owns the drawer for both donuts. One instance rather than one per chart:
 * a single AnimatePresence, one Escape handler, and clicking a segment in the
 * second chart while the first one's drawer is open just swaps its contents. */
export function SourceCharts({ channels, utm }: { channels: ChannelRow[]; utm: UtmRow[] }) {
  const t = useTranslations("sourceScreen");
  const tChannel = useTranslations("channels");
  const [segment, setSegment] = useState<Segment | null>(null);

  const title =
    segment === null
      ? ""
      : segment.kind === "channel"
        ? channelLabel(tChannel, segment.channel)
        : (segment.utmSource ?? t("notSet"));

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] sm:p-8">
        <ChannelDonut channels={channels} onSelect={(channel) => setSegment({ kind: "channel", channel })} />
      </div>

      {utm.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">{t("utmHeading")}</h2>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)] sm:p-8">
            <UtmDonut utm={utm} onSelect={(utmSource) => setSegment({ kind: "utm", utmSource })} />
          </div>
        </div>
      )}

      <SegmentPanel segment={segment} title={title} onClose={() => setSegment(null)} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type PieSectorDataItem } from "recharts";
import { useTranslations } from "next-intl";
import { channelLabel } from "@/i18n/channel-labels";
import { CHANNEL_COLORS } from "./labels";
import type { ChannelRow } from "./queries";

function renderActiveShape(props: PieSectorDataItem) {
  return <Sector {...props} outerRadius={(Number(props.outerRadius) || 0) + 8} />;
}

function ChannelTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChannelRow & { isBest: boolean } }[] }) {
  const tChannel = useTranslations("channels");
  const t = useTranslations("sourceScreen");
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="tooltip-pop min-w-[250px] rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-2xl">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-gray-900">{channelLabel(tChannel, d.channel)}</span>
        {d.isBest && (
          <span className="rounded-full bg-[#5B4FE9]/10 px-2 py-0.5 text-xs font-semibold text-[#5B4FE9]">{t("best")}</span>
        )}
      </div>
      <dl className="mt-2.5 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-gray-400">{t("prospects")}</dt>
          <dd className="font-medium text-gray-900">{d.total}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-400">{t("active")}</dt>
          <dd className="font-medium text-gray-900">{d.active}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-400">{t("won")}</dt>
          <dd className="font-medium text-gray-900">{d.won}</dd>
        </div>
      </dl>
      <div className="mt-3.5 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[#5B4FE9]"
            style={{ width: `${Math.min(d.conversionPct, 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-gray-900">{d.conversionPct}%</span>
      </div>
    </div>
  );
}

export function ChannelDonut({ channels }: { channels: ChannelRow[] }) {
  const tChannel = useTranslations("channels");
  const t = useTranslations("sourceScreen");
  const total = channels.reduce((sum, c) => sum + c.total, 0);
  const bestChannel = channels.find((c) => c.total > 0)?.channel;
  const data = channels.map((c) => ({ ...c, isBest: c.channel === bestChannel }));
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div>
      {/* Dims the rest of the page while a segment's tooltip is open, so the
          card reads as the focus — escapes the chart's own container via
          fixed positioning, sits below the chart (which gets relative z-50
          below) but above everything else on the page. */}
      <div
        aria-hidden
        className={
          "pointer-events-none fixed inset-0 z-40 bg-gray-900/35 backdrop-blur-[1px] transition-opacity duration-200 " +
          (isHovering ? "opacity-100" : "opacity-0")
        }
      />

      <div className="relative z-50 mx-auto h-[280px] max-w-[320px]">
        {/* Rendered before the chart so the (fully opaque) tooltip — part of
            the chart's own DOM subtree — paints on top of it instead of the
            other way around. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold text-gray-900">{total}</span>
          <span className="text-xs text-gray-400">{t("totalProspects")}</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="channel"
              innerRadius={72}
              outerRadius={104}
              paddingAngle={2}
              cornerRadius={4}
              activeShape={renderActiveShape}
              isAnimationActive
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              {data.map((d) => (
                <Cell key={d.channel} fill={CHANNEL_COLORS[d.channel] ?? "#5B4FE9"} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<ChannelTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="relative z-50 mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {channels.map((c) => (
          <span key={c.channel} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: CHANNEL_COLORS[c.channel] ?? "#5B4FE9" }}
            />
            {channelLabel(tChannel, c.channel)}
          </span>
        ))}
      </div>
    </div>
  );
}

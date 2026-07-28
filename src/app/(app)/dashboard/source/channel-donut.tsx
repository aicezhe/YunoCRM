"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type PieSectorDataItem } from "recharts";
import { CHANNEL_COLORS, CHANNEL_LABELS } from "./labels";
import type { ChannelRow } from "./queries";

function renderActiveShape(props: PieSectorDataItem) {
  return <Sector {...props} outerRadius={(Number(props.outerRadius) || 0) + 8} />;
}

function ChannelTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChannelRow & { isBest: boolean } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="tooltip-pop min-w-[210px] rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900">{CHANNEL_LABELS[d.channel] ?? d.channel}</span>
        {d.isBest && (
          <span className="rounded-full bg-[#5B4FE9]/10 px-2 py-0.5 text-xs font-semibold text-[#5B4FE9]">Best</span>
        )}
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-gray-400">Prospects</dt>
          <dd className="font-medium text-gray-900">{d.total}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-400">Active</dt>
          <dd className="font-medium text-gray-900">{d.active}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-400">Won</dt>
          <dd className="font-medium text-gray-900">{d.won}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center gap-2">
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
  const total = channels.reduce((sum, c) => sum + c.total, 0);
  const bestChannel = channels.find((c) => c.total > 0)?.channel;
  const data = channels.map((c) => ({ ...c, isBest: c.channel === bestChannel }));

  return (
    <div>
      <div className="relative mx-auto h-[280px] max-w-[320px]">
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
            >
              {data.map((d) => (
                <Cell key={d.channel} fill={CHANNEL_COLORS[d.channel] ?? "#5B4FE9"} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<ChannelTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold text-gray-900">{total}</span>
          <span className="text-xs text-gray-400">Total prospects</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {channels.map((c) => (
          <span key={c.channel} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: CHANNEL_COLORS[c.channel] ?? "#5B4FE9" }}
            />
            {CHANNEL_LABELS[c.channel] ?? c.channel}
          </span>
        ))}
      </div>
    </div>
  );
}

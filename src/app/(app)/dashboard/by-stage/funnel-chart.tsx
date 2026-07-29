"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import type { StageRow } from "./queries";

const TERMINAL_COLOR: Record<string, string> = { Won: "#22C55E", Lost: "#9CA3AF" };
const DEFAULT_COLOR = "#5B4FE9";

export function FunnelChart({ stages }: { stages: StageRow[] }) {
  // The enum value itself (stages[].stage) is never touched — only the
  // axis label and tooltip name shown for it — so nothing here can affect
  // which stage a bar represents.
  const tStage = useTranslations("stages");
  const t = useTranslations("byStageScreen");
  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stages} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F1FF" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
          <YAxis
            type="category"
            dataKey="stage"
            width={110}
            tick={{ fontSize: 13, fill: "#374151" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => tStage(value)}
          />
          <Tooltip
            cursor={{ fill: "#5B4FE9", fillOpacity: 0.06 }}
            formatter={(value, _name, item) => [`${value} (${item.payload.pct}%)`, t("tooltipProspects")]}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={28}>
            {stages.map((s) => (
              <Cell key={s.stage} fill={TERMINAL_COLOR[s.stage] ?? DEFAULT_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

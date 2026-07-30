"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type PieSectorDataItem } from "recharts";
import { UTM_COLORS } from "./labels";
import type { UtmRow } from "./queries";

function renderActiveShape(props: PieSectorDataItem) {
  return <Sector {...props} outerRadius={props.outerRadius + 6} />;
}

// React key for the "utm_source is null" slice — the raw value can't be used
// as a key, and the translated label isn't stable across locales.
const UNSET_KEY = "__utm_unset__";

/** Recharts types a sector click as the rendered sector's props; the row that
 * produced it rides along on `payload`. */
function rowOf(item: PieSectorDataItem): UtmRow | undefined {
  return (item as { payload?: UtmRow }).payload;
}

function UtmTooltip({ active, payload }: { active?: boolean; payload?: { payload: UtmRow }[] }) {
  const t = useTranslations("sourceScreen");
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="tooltip-pop min-w-[200px] rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-2xl">
      <p className="text-base font-semibold text-gray-900">{d.utmSource ?? t("notSet")}</p>
      <div className="mt-1.5 flex items-center justify-between text-sm">
        <span className="text-gray-400">{t("prospects")}</span>
        <span className="font-medium text-gray-900">{d.total}</span>
      </div>
    </div>
  );
}

export function UtmDonut({
  utm,
  onSelect,
  panelOpen = false,
}: {
  utm: UtmRow[];
  onSelect: (utmSource: string | null) => void;
  /** See ChannelDonut: the drawer covers the chart, so no pointerleave ever
   * arrives and the hover card would stay frozen underneath it. */
  panelOpen?: boolean;
}) {
  const t = useTranslations("sourceScreen");
  const total = utm.reduce((sum, u) => sum + u.total, 0);
  const [isHovering, setIsHovering] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fired on drawer close (and harmlessly on mount): recharts still holds
  // the hover state from before the drawer covered the chart — the pointer
  // never actually left it — so without this the hover card pops right back
  // the moment the drawer's suppression is lifted. React handles the
  // synthetic mouseleave dispatched on the chart root like a real one.
  useEffect(() => {
    if (panelOpen) return;
    wrapRef.current
      ?.querySelector(".recharts-wrapper")
      ?.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
  }, [panelOpen]);

  return (
    <div>
      <div
        aria-hidden
        className={
          "pointer-events-none fixed inset-0 z-40 bg-gray-900/35 backdrop-blur-[1px] transition-opacity duration-200 " +
          (isHovering && !panelOpen ? "opacity-100" : "opacity-0")
        }
      />

      <div ref={wrapRef} className="relative z-50 mx-auto h-[200px] max-w-[240px]">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-gray-900">{total}</span>
          <span className="text-xs text-gray-400">{t("websiteProspects")}</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={utm}
              dataKey="total"
              nameKey="utmSource"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={2}
              cornerRadius={4}
              activeShape={panelOpen ? undefined : renderActiveShape}
              isAnimationActive
              className="cursor-pointer"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onClick={(item) => {
                const d = rowOf(item);
                if (!d || d.total === 0) return;
                setIsHovering(false);
                onSelect(d.utmSource ?? null);
              }}
            >
              {utm.map((u, i) => (
                <Cell key={u.utmSource ?? UNSET_KEY} fill={UTM_COLORS[i % UTM_COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<UtmTooltip />} active={panelOpen ? false : undefined} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="relative z-50 mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {utm.map((u, i) => (
          <span key={u.utmSource ?? UNSET_KEY} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: UTM_COLORS[i % UTM_COLORS.length] }}
            />
            {u.utmSource ?? t("notSet")}
          </span>
        ))}
      </div>
    </div>
  );
}

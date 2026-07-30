import { User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BackButton } from "@/components/back-button";
import { CopyEmail } from "@/components/copy-email";
import { channelLabel } from "@/i18n/channel-labels";
import { getCompanyDetail, type ProspectDetail } from "./queries";

const STAGE_COLORS: Record<string, string> = {
  Won: "bg-green-100 text-green-700",
  Lost: "bg-gray-200 text-gray-600",
};

function fmtDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function fmtDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StagePill({ stage, label }: { stage: string; label: string }) {
  return (
    <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (STAGE_COLORS[stage] ?? "bg-[#5B4FE9]/10 text-[#5B4FE9]")}>
      {label}
    </span>
  );
}

type Translator = (key: string, values?: Record<string, string>) => string;

function ProspectCard({
  prospect,
  t,
  tStage,
  tChannel,
  tActor,
  tTaskStatus,
  tInterType,
  tInterDir,
  locale,
}: {
  prospect: ProspectDetail;
  t: Translator;
  tStage: (key: string) => string;
  tChannel: (key: string) => string;
  tActor: (key: string) => string;
  tTaskStatus: (key: string) => string;
  tInterType: (key: string) => string;
  tInterDir: (key: string) => string;
  locale: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_20px_45px_-30px_rgba(91,79,233,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StagePill stage={prospect.currentStage} label={tStage(prospect.currentStage)} />
          <span className="text-sm text-gray-500">
            {channelLabel(tChannel, prospect.channel)}
            {prospect.utmSource ? ` · ${prospect.utmSource}` : ""}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {t("owner")}: {prospect.ownerName ?? t("unassigned")}
        </span>
      </div>

      {prospect.currentStage === "Lost" && prospect.lostReason && (
        <p className="border-b border-gray-50 bg-gray-50 px-5 py-3 text-sm text-gray-600 sm:px-6">
          <span className="font-medium text-gray-700">{t("lostReason")}</span> {prospect.lostReason}
        </p>
      )}

      <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-2">
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("stageHistory")}</h3>
          <ol className="mt-3 space-y-3">
            {prospect.transitions.map((tr, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#5B4FE9]" />
                <div>
                  <p className="text-gray-800">
                    {tr.fromStage
                      ? t("transition", { from: tStage(tr.fromStage), to: tStage(tr.toStage) })
                      : t("createdAs", { stage: tStage(tr.toStage) })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {fmtDateTime(tr.occurredAt, locale)} · {tActor(tr.actorType)}
                  </p>
                </div>
              </li>
            ))}
            {prospect.transitions.length === 0 && <p className="text-sm text-gray-400">{t("noStageHistory")}</p>}
          </ol>
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("tasks")}</h3>
          <ul className="mt-3 space-y-2">
            {prospect.tasks.map((task) => (
              <li key={task.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className={task.status === "open" ? "text-gray-800" : "text-gray-400 line-through"}>{task.title}</p>
                  <p className="text-xs text-gray-400">
                    {t("due", { date: fmtDate(task.dueDate, locale) })} · {task.assigneeName ?? t("unassigned")}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
                    (task.status === "open"
                      ? "bg-amber-100 text-amber-700"
                      : task.status === "done"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500")
                  }
                >
                  {tTaskStatus(task.status)}
                </span>
              </li>
            ))}
            {prospect.tasks.length === 0 && <p className="text-sm text-gray-400">{t("noTasks")}</p>}
          </ul>
        </section>

        <section className="lg:col-span-2">
          <h3 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("interactions")}</h3>
          <ul className="mt-3 space-y-3">
            {prospect.interactions.map((i) => (
              <li key={i.id} className="rounded-2xl bg-gray-50 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{i.subject ?? tInterType(i.type)}</span>
                  <span className="text-xs text-gray-400">{fmtDateTime(i.occurredAt, locale)}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {tInterType(i.type)}
                  {i.direction ? ` · ${tInterDir(i.direction)}` : ""}
                  {i.contactName ? ` · ${i.contactName}` : ""}
                </p>
              </li>
            ))}
            {prospect.interactions.length === 0 && (
              <p className="text-sm text-gray-400">{t("noInteractions")}</p>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, t, tChannel, tStage, tActor, tTaskStatus, tInterType, tInterDir, locale] = await Promise.all([
    getCompanyDetail(id),
    getTranslations("companyDetail"),
    getTranslations("channels"),
    getTranslations("stages"),
    getTranslations("actorType"),
    getTranslations("taskStatus"),
    getTranslations("interactionType"),
    getTranslations("interactionDirection"),
    getLocale(),
  ]);

  if (result.state === "not_found") {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-6">
        <BackButton fallbackHref="/search" />
        <p className="mt-6 rounded-2xl bg-white px-5 py-6 text-sm text-gray-500 shadow-sm">{t("notFound")}</p>
      </div>
    );
  }

  if (result.state === "error") {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-6">
        <BackButton fallbackHref="/search" />
        <p className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{t("loadError")}</p>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="mx-auto max-w-4xl px-5 pt-4 pb-8 sm:px-6 sm:pt-6">
      <BackButton fallbackHref="/search" />

      <div className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{data.name}</h1>
        {data.domain && <p className="mt-1 text-sm text-gray-500">{data.domain}</p>}
      </div>

      <section className="mt-6">
        <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{t("contacts")}</h2>
        {data.contacts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">{t("noContacts")}</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.contacts.map((c) => (
              <li key={c.id} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <User className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
                  {c.name ?? c.email}
                  {c.title && <span className="font-normal text-gray-400">· {c.title}</span>}
                </p>
                <CopyEmail email={c.email} className="mt-1 max-w-full text-xs text-gray-500" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 space-y-6">
        <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
          {data.prospects.length > 1 ? t("prospects") : t("prospect")}
        </h2>
        {data.prospects.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noProspect")}</p>
        ) : (
          data.prospects.map((p) => (
            <ProspectCard
              key={p.id}
              prospect={p}
              t={t}
              tStage={tStage}
              tChannel={tChannel}
              tActor={tActor}
              tTaskStatus={tTaskStatus}
              tInterType={tInterType}
              tInterDir={tInterDir}
              locale={locale}
            />
          ))
        )}
      </section>
    </div>
  );
}

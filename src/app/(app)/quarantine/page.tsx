import { getTranslations } from "next-intl/server";
import { getOpenQuarantineItems, getResolvedQuarantineItems } from "./queries";
import { QuarantineClient } from "./quarantine-client";

async function Header() {
  const t = await getTranslations("quarantine");
  return (
    <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-6 sm:pt-8">
      <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-xl text-sm text-gray-500">{t("subtitle")}</p>
    </div>
  );
}

export default async function QuarantinePage() {
  const [report, resolved, t] = await Promise.all([
    getOpenQuarantineItems(),
    getResolvedQuarantineItems(),
    getTranslations("quarantine"),
  ]);

  return (
    <>
      <Header />
      <div className="mx-auto max-w-3xl px-5 pt-6 pb-4 sm:px-6">
        {report.state === "error" && (
          <p className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{t("loadError")}</p>
        )}
        {report.state === "empty" && <QuarantineClient initialItems={[]} resolvedItems={resolved} />}
        {report.state === "ok" && <QuarantineClient initialItems={report.items} resolvedItems={resolved} />}
      </div>
    </>
  );
}

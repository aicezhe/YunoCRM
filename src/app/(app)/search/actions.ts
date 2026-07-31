"use server";

import { listAllCompaniesAlphabetical, searchNormal, searchSmart, type SearchReport } from "./queries";
import { getCompanyDetail, type CompanyDetailResult } from "../companies/[id]/queries";

export async function runSearch(query: string, smart: boolean): Promise<SearchReport> {
  const trimmed = query.trim();
  if (!trimmed) return listAllCompaniesAlphabetical();
  return smart ? searchSmart(trimmed) : searchNormal(trimmed);
}

/** Backs the in-page company overlay (the card-flip panel) so it can
 * fetch full detail without a route navigation. */
export async function loadCompanyOverlay(companyId: string): Promise<CompanyDetailResult> {
  return getCompanyDetail(companyId);
}

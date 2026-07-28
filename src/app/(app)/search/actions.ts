"use server";

import { listAllCompaniesAlphabetical, searchNormal, searchSmart, type SearchReport } from "./queries";

export async function runSearch(query: string, smart: boolean): Promise<SearchReport> {
  const trimmed = query.trim();
  if (!trimmed) return listAllCompaniesAlphabetical();
  return smart ? searchSmart(trimmed) : searchNormal(trimmed);
}

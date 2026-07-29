/**
 * Pure text-building logic for company embeddings — no I/O, no DB, so it
 * can be unit-tested without an API key or a database.
 *
 * Why this exists: companies in this dataset have no description column.
 * The only business signal available is the name itself, and these are
 * Italian trade names that state the industry outright — "Fonderia
 * Valchiavenna" is a foundry, "Caseificio Valpadana" a dairy, "Tessitura
 * Comasca" a weaving mill. Embedding just the raw name leaves that meaning
 * locked behind a language barrier: a user searching "cheese producer" in
 * English gets nothing, because the embedding never saw the word.
 *
 * So each recognised Italian trade term contributes plain-English industry
 * hints to the embedded text. Every entry below is justified by a company
 * that actually exists in this dataset — no speculative vocabulary.
 */

/** Italian (and a few German/English) trade terms -> industry hints.
 * Matched case-insensitively as whole words against the company name. */
export const INDUSTRY_TERMS: { term: RegExp; hints: string[]; example: string }[] = [
  // --- Metal, machining, industrial manufacturing ------------------------
  { term: /fonderi[ae]/i, hints: ["foundry", "metal casting", "metallurgy"], example: "Fonderia Valchiavenna" },
  { term: /ferro|acciai/i, hints: ["iron and steel", "metal trading"], example: "Ferro & Acciai Trading" },
  { term: /torneria/i, hints: ["machining", "turning", "precision engineering"], example: "Torneria Automatica Lecco" },
  { term: /officin[ae]/i, hints: ["mechanical workshop", "engineering"], example: "Officine Brembate" },
  { term: /meccanotek|meccatronica|meccanic/i, hints: ["mechanical engineering", "mechatronics"], example: "Meccanotek" },
  { term: /robotics/i, hints: ["robotics", "automation"], example: "Meccatronica Robotics" },
  { term: /weld/i, hints: ["welding", "metal fabrication"], example: "TechnoWeld" },
  { term: /stampi|mould|plast/i, hints: ["plastic moulding", "injection moulding"], example: "StampiPlast" },
  { term: /marmi/i, hints: ["marble", "stone"], example: "Marmi Apuani" },
  { term: /cave|inerti/i, hints: ["quarry", "aggregates", "mining"], example: "Cave & Inerti SpA" },
  { term: /cartiera/i, hints: ["paper mill", "paper manufacturing"], example: "Cartiera del Serio" },
  { term: /revamping/i, hints: ["industrial retrofit", "plant upgrade"], example: "Revamping Industriale" },

  // --- Food, drink, agriculture ------------------------------------------
  { term: /caseificio/i, hints: ["dairy", "cheese producer"], example: "Caseificio Valpadana" },
  { term: /salumificio/i, hints: ["cured meats", "salami producer", "food"], example: "Salumificio Dorati" },
  { term: /molini/i, hints: ["flour mill", "grain milling"], example: "Molini Bergamaschi" },
  { term: /vini/i, hints: ["wine", "winery"], example: "Vini Colline Toscane" },
  { term: /agrifood|agri/i, hints: ["agriculture", "food production"], example: "AgriFood Piemonte" },

  // --- Textile and craft --------------------------------------------------
  { term: /tessitura/i, hints: ["weaving mill", "textiles"], example: "Tessitura Comasca" },
  { term: /sartoria/i, hints: ["tailoring", "garment manufacturing"], example: "Sartoria Industriale Marche" },
  { term: /selleria/i, hints: ["saddlery", "leather goods"], example: "Selleria Toscana" },

  // --- Construction and building ------------------------------------------
  { term: /costruzioni|edil/i, hints: ["construction", "building"], example: "Impresa Costruzioni Sud" },
  { term: /restauri/i, hints: ["restoration", "heritage building"], example: "EdilRestauri" },
  { term: /serramenti/i, hints: ["windows and doors", "frames"], example: "Bianchi Serramenti" },
  { term: /vetreria/i, hints: ["glassworks", "glass manufacturing"], example: "Vetreria Artigiana Veneta" },
  { term: /ascensori/i, hints: ["elevators", "lifts"], example: "Ascensori Rapidi" },
  { term: /progetto casa|immobil/i, hints: ["real estate", "housing"], example: "Progetto Casa SpA" },

  // --- Energy, utilities, environment --------------------------------------
  { term: /eolico/i, hints: ["wind power", "renewable energy"], example: "Eolico Sud Holding" },
  { term: /green energy|energia/i, hints: ["energy", "renewable energy"], example: "Green Energy Brianza" },
  { term: /depurazione|acque/i, hints: ["water treatment", "environmental services"], example: "Depurazione Acque Italia" },
  { term: /termoidraulica/i, hints: ["heating and plumbing", "HVAC"], example: "Termoidraulica Nazionale" },
  { term: /idraulica/i, hints: ["plumbing", "hydraulics"], example: "Idraulica Industriale Veneta" },
  { term: /frigotecnica/i, hints: ["refrigeration", "cooling systems"], example: "Frigotecnica Emilia" },
  { term: /elettr|impianti/i, hints: ["electrical systems", "industrial plant"], example: "Elettra Impianti" },

  // --- Professional services -----------------------------------------------
  { term: /studio legale/i, hints: ["law firm", "legal services", "lawyers"], example: "Studio Legale Aureli" },
  { term: /tributario/i, hints: ["tax advisory", "accounting"], example: "Studio Tributario Belli" },
  { term: /studio/i, hints: ["professional practice", "consultancy"], example: "Studio Lanfranchi" },
  { term: /advisor|advisory/i, hints: ["advisory", "consulting"], example: "NordEst Advisory" },
  { term: /consulting/i, hints: ["consulting", "business services"], example: "Consulting Duomo" },
  { term: /ingegneria/i, hints: ["engineering", "design"], example: "Ingegneria Delta" },
  { term: /partners/i, hints: ["professional partnership", "advisory"], example: "Verdi & Partners" },

  // --- Finance and insurance -------------------------------------------------
  { term: /banca/i, hints: ["bank", "banking"], example: "Banca Orobica" },
  { term: /capital/i, hints: ["investment", "capital management"], example: "Alpina Capital" },
  { term: /fondo|sgr|fondazione/i, hints: ["investment fund", "asset management"], example: "Fondo Ticino SGR" },
  { term: /fintech/i, hints: ["fintech", "financial technology"], example: "Fintech Borsa Lab" },
  { term: /corporate finance|kredit|credit/i, hints: ["corporate finance", "credit"], example: "Corporate Finance Lab" },
  { term: /insurance|assicura/i, hints: ["insurance", "brokerage"], example: "Insurance Broker Milano" },
  { term: /broker/i, hints: ["brokerage", "intermediary"], example: "Broker Energia" },

  // --- Logistics and transport ------------------------------------------------
  { term: /trasporti/i, hints: ["haulage", "trucking", "freight transport"], example: "Trasporti Eccezionali TEV" },
  { term: /logistica|logistik|logistics/i, hints: ["logistics", "supply chain"], example: "Logistica Adda" },
  { term: /pack/i, hints: ["packaging"], example: "Pack&Go Solutions" },
  { term: /nautica/i, hints: ["marine", "boating"], example: "Nautica Ligure" },

  // --- Health, pharma, chemicals -----------------------------------------------
  { term: /farma|pharma/i, hints: ["pharmaceutical", "healthcare"], example: "Farmadistribuzione Nord" },
  { term: /medsupply|med/i, hints: ["medical supplies", "healthcare"], example: "MedSupply Italia" },
  { term: /biolab|diagnostics/i, hints: ["diagnostics", "laboratory", "biotech"], example: "BioLab Diagnostics" },
  { term: /chimica/i, hints: ["chemicals", "chemical industry"], example: "Chimica Lambro" },
  { term: /cosmetici/i, hints: ["cosmetics", "personal care"], example: "Cosmetici Riviera" },

  // --- Technology and telecom ---------------------------------------------------
  { term: /software|gestionali/i, hints: ["software", "business software"], example: "Software Gestionali Nord" },
  { term: /digital factory|digital/i, hints: ["digital agency", "web development"], example: "Digital Factory Roma" },
  { term: /analytics|databridge|data/i, hints: ["data analytics", "business intelligence"], example: "DataBridge Analytics" },
  { term: /rete fibra|fibra/i, hints: ["fibre network", "telecommunications"], example: "Rete Fibra Sud" },

  // --- Security and HR -------------------------------------------------------------
  { term: /sicurezza|vigilanza/i, hints: ["security", "surveillance"], example: "Sicurezza & Vigilanza Group" },
  { term: /\bhr\b|risorse umane/i, hints: ["human resources", "recruitment"], example: "HR Evolution" },
];

/**
 * Plain-English industry hints implied by an Italian trade name, deduped
 * and order-stable. Returns an empty array when nothing is recognised —
 * the name alone still gets embedded, just without extra signal.
 */
export function industryHints(companyName: string): string[] {
  const hints: string[] = [];
  for (const { term, hints: termHints } of INDUSTRY_TERMS) {
    if (term.test(companyName)) {
      for (const h of termHints) if (!hints.includes(h)) hints.push(h);
    }
  }
  return hints;
}

export interface EmbeddableCompany {
  name: string;
  domain: string | null;
  channel: string | null;
  stage: string | null;
}

/**
 * The text actually sent to the embedding model. Written as prose rather
 * than dot-separated fragments: embedding models are trained on natural
 * language, and "Caseificio Valpadana is a company in dairy, cheese
 * producer." places the company far closer to an English query about
 * cheese than the bare name ever could.
 */
export function embeddingText(c: EmbeddableCompany): string {
  const sentences: string[] = [];
  const hints = industryHints(c.name);

  sentences.push(hints.length > 0 ? `${c.name} is a company in ${hints.join(", ")}.` : `${c.name} is a company.`);
  if (c.domain) sentences.push(`Its website is ${c.domain}.`);
  if (c.channel) sentences.push(`It was acquired through the ${c.channel.replace(/_/g, " ")} channel.`);
  if (c.stage) sentences.push(`Its current sales stage is ${c.stage}.`);

  return sentences.join(" ");
}

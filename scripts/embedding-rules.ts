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
 * English, or "сыроварня" in Russian, gets nothing — the embedding never
 * saw the word.
 *
 * So each recognised Italian trade term contributes industry hints in both
 * English and Russian to the embedded text. Italian itself needs no hints:
 * the company name already carries it. Every entry below is justified by a
 * company that actually exists in this dataset — no speculative vocabulary.
 */

export interface IndustryTerm {
  /** Matched case-insensitively against the company name. */
  term: RegExp;
  en: string[];
  ru: string[];
  /** The dataset company this rule exists for — asserted in the tests. */
  example: string;
}

export const INDUSTRY_TERMS: IndustryTerm[] = [
  // --- Metal, machining, industrial manufacturing ------------------------
  { term: /fonderi[ae]/i, en: ["foundry", "metal casting", "metallurgy"], ru: ["литейное производство", "литьё металла", "металлургия"], example: "Fonderia Valchiavenna" },
  { term: /ferro|acciai/i, en: ["iron and steel", "metal trading"], ru: ["сталь", "металлопрокат", "чёрные металлы"], example: "Ferro & Acciai Trading" },
  { term: /torneria/i, en: ["machining", "turning", "precision engineering"], ru: ["механическая обработка", "токарное производство"], example: "Torneria Automatica Lecco" },
  { term: /officin[ae]/i, en: ["mechanical workshop", "engineering"], ru: ["механические мастерские", "машиностроение"], example: "Officine Brembate" },
  { term: /meccanotek|meccatronica|meccanic/i, en: ["mechanical engineering", "mechatronics"], ru: ["машиностроение", "мехатроника"], example: "Meccanotek" },
  { term: /robotics/i, en: ["robotics", "automation"], ru: ["робототехника", "автоматизация"], example: "Meccatronica Robotics" },
  { term: /weld/i, en: ["welding", "metal fabrication"], ru: ["сварка", "металлоконструкции"], example: "TechnoWeld" },
  { term: /stampi|mould|plast/i, en: ["plastic moulding", "injection moulding"], ru: ["литьё пластмасс", "пресс-формы"], example: "StampiPlast" },
  { term: /marmi/i, en: ["marble", "stone"], ru: ["мрамор", "камень"], example: "Marmi Apuani" },
  { term: /cave|inerti/i, en: ["quarry", "aggregates", "mining"], ru: ["карьер", "щебень", "добыча"], example: "Cave & Inerti SpA" },
  { term: /cartiera/i, en: ["paper mill", "paper manufacturing"], ru: ["бумажная фабрика", "производство бумаги"], example: "Cartiera del Serio" },
  { term: /revamping/i, en: ["industrial retrofit", "plant upgrade"], ru: ["модернизация производства"], example: "Revamping Industriale" },

  // --- Food, drink, agriculture ------------------------------------------
  { term: /caseificio/i, en: ["dairy", "cheese producer"], ru: ["молочный завод", "сыроварня", "сыр"], example: "Caseificio Valpadana" },
  { term: /salumificio/i, en: ["cured meats", "salami producer", "food"], ru: ["мясокомбинат", "колбасные изделия"], example: "Salumificio Dorati" },
  { term: /molini/i, en: ["flour mill", "grain milling"], ru: ["мукомольный завод", "мельница"], example: "Molini Bergamaschi" },
  { term: /vini/i, en: ["wine", "winery"], ru: ["вино", "винодельня"], example: "Vini Colline Toscane" },
  { term: /agrifood|agri/i, en: ["agriculture", "food production"], ru: ["сельское хозяйство", "продукты питания"], example: "AgriFood Piemonte" },

  // --- Textile and craft --------------------------------------------------
  { term: /tessitura/i, en: ["weaving mill", "textiles"], ru: ["ткацкая фабрика", "текстиль"], example: "Tessitura Comasca" },
  { term: /sartoria/i, en: ["tailoring", "garment manufacturing"], ru: ["швейное производство", "пошив одежды"], example: "Sartoria Industriale Marche" },
  { term: /selleria/i, en: ["saddlery", "leather goods"], ru: ["кожевенные изделия", "шорная мастерская"], example: "Selleria Toscana" },

  // --- Construction and building ------------------------------------------
  { term: /costruzioni|edil/i, en: ["construction", "building"], ru: ["строительство", "строительная компания"], example: "Impresa Costruzioni Sud" },
  { term: /restauri/i, en: ["restoration", "heritage building"], ru: ["реставрация", "реставрация зданий"], example: "EdilRestauri" },
  { term: /serramenti/i, en: ["windows and doors", "frames"], ru: ["окна и двери", "оконные конструкции"], example: "Bianchi Serramenti" },
  { term: /vetreria/i, en: ["glassworks", "glass manufacturing"], ru: ["стекольный завод", "производство стекла"], example: "Vetreria Artigiana Veneta" },
  { term: /ascensori/i, en: ["elevators", "lifts"], ru: ["лифты", "подъёмное оборудование"], example: "Ascensori Rapidi" },
  { term: /progetto casa|immobil/i, en: ["real estate", "housing"], ru: ["недвижимость", "жильё"], example: "Progetto Casa SpA" },

  // --- Energy, utilities, environment --------------------------------------
  { term: /eolico/i, en: ["wind power", "renewable energy"], ru: ["ветроэнергетика", "возобновляемая энергия"], example: "Eolico Sud Holding" },
  { term: /green energy|energia/i, en: ["energy", "renewable energy"], ru: ["энергетика", "зелёная энергия"], example: "Green Energy Brianza" },
  { term: /depurazione|acque/i, en: ["water treatment", "environmental services"], ru: ["водоочистка", "экология"], example: "Depurazione Acque Italia" },
  { term: /termoidraulica/i, en: ["heating and plumbing", "HVAC"], ru: ["отопление и сантехника", "ОВиК"], example: "Termoidraulica Nazionale" },
  { term: /idraulica/i, en: ["plumbing", "hydraulics"], ru: ["сантехника", "гидравлика"], example: "Idraulica Industriale Veneta" },
  { term: /frigotecnica/i, en: ["refrigeration", "cooling systems"], ru: ["холодильное оборудование", "системы охлаждения"], example: "Frigotecnica Emilia" },
  { term: /elettr|impianti/i, en: ["electrical systems", "industrial plant"], ru: ["электрооборудование", "промышленные установки"], example: "Elettra Impianti" },

  // --- Professional services -----------------------------------------------
  { term: /studio legale/i, en: ["law firm", "legal services", "lawyers"], ru: ["юридическая фирма", "адвокаты", "юристы"], example: "Studio Legale Aureli" },
  { term: /tributario/i, en: ["tax advisory", "accounting"], ru: ["налоговый консалтинг", "бухгалтерия"], example: "Studio Tributario Belli" },
  { term: /studio/i, en: ["professional practice", "consultancy"], ru: ["бюро", "консалтинг"], example: "Studio Lanfranchi" },
  { term: /advisor|advisory/i, en: ["advisory", "consulting"], ru: ["консалтинг", "советники"], example: "NordEst Advisory" },
  { term: /consulting/i, en: ["consulting", "business services"], ru: ["консалтинг", "бизнес-услуги"], example: "Consulting Duomo" },
  { term: /ingegneria/i, en: ["engineering", "design"], ru: ["инжиниринг", "проектирование"], example: "Ingegneria Delta" },
  { term: /partners/i, en: ["professional partnership", "advisory"], ru: ["партнёрство", "консалтинг"], example: "Verdi & Partners" },

  // --- Finance and insurance -------------------------------------------------
  { term: /banca/i, en: ["bank", "banking"], ru: ["банк", "банковские услуги"], example: "Banca Orobica" },
  { term: /capital/i, en: ["investment", "capital management"], ru: ["инвестиции", "управление капиталом"], example: "Alpina Capital" },
  { term: /fondo|sgr|fondazione/i, en: ["investment fund", "asset management"], ru: ["инвестиционный фонд", "управление активами"], example: "Fondo Ticino SGR" },
  { term: /fintech/i, en: ["fintech", "financial technology"], ru: ["финтех", "финансовые технологии"], example: "Fintech Borsa Lab" },
  { term: /corporate finance|kredit|credit/i, en: ["corporate finance", "credit"], ru: ["корпоративные финансы", "кредитование"], example: "Corporate Finance Lab" },
  { term: /insurance|assicura/i, en: ["insurance", "brokerage"], ru: ["страхование", "страховой брокер"], example: "Insurance Broker Milano" },
  { term: /broker/i, en: ["brokerage", "intermediary"], ru: ["брокер", "посредник"], example: "Broker Energia" },

  // --- Logistics and transport ------------------------------------------------
  { term: /trasporti/i, en: ["haulage", "trucking", "freight transport"], ru: ["грузоперевозки", "автоперевозки", "транспорт"], example: "Trasporti Eccezionali TEV" },
  { term: /logistica|logistik|logistics/i, en: ["logistics", "supply chain"], ru: ["логистика", "цепочка поставок"], example: "Logistica Adda" },
  { term: /pack/i, en: ["packaging"], ru: ["упаковка"], example: "Pack&Go Solutions" },
  { term: /nautica/i, en: ["marine", "boating"], ru: ["судостроение", "катера"], example: "Nautica Ligure" },

  // --- Health, pharma, chemicals -----------------------------------------------
  { term: /farma|pharma/i, en: ["pharmaceutical", "healthcare"], ru: ["фармацевтика", "здравоохранение"], example: "Farmadistribuzione Nord" },
  { term: /medsupply|med/i, en: ["medical supplies", "healthcare"], ru: ["медицинское оборудование", "медтехника"], example: "MedSupply Italia" },
  { term: /biolab|diagnostics/i, en: ["diagnostics", "laboratory", "biotech"], ru: ["диагностика", "лаборатория", "биотехнологии"], example: "BioLab Diagnostics" },
  { term: /chimica/i, en: ["chemicals", "chemical industry"], ru: ["химия", "химическая промышленность"], example: "Chimica Lambro" },
  { term: /cosmetici/i, en: ["cosmetics", "personal care"], ru: ["косметика", "уход за собой"], example: "Cosmetici Riviera" },

  // --- Technology and telecom ---------------------------------------------------
  { term: /software|gestionali/i, en: ["software", "business software"], ru: ["программное обеспечение", "софт"], example: "Software Gestionali Nord" },
  { term: /digital factory|digital/i, en: ["digital agency", "web development"], ru: ["веб-разработка", "digital-агентство"], example: "Digital Factory Roma" },
  { term: /analytics|databridge|data/i, en: ["data analytics", "business intelligence"], ru: ["аналитика данных", "бизнес-аналитика"], example: "DataBridge Analytics" },
  { term: /rete fibra|fibra/i, en: ["fibre network", "telecommunications"], ru: ["оптоволокно", "телеком"], example: "Rete Fibra Sud" },

  // --- Security and HR -------------------------------------------------------------
  { term: /sicurezza|vigilanza/i, en: ["security", "surveillance"], ru: ["охрана", "безопасность", "видеонаблюдение"], example: "Sicurezza & Vigilanza Group" },
  { term: /\bhr\b|risorse umane/i, en: ["human resources", "recruitment"], ru: ["кадры", "подбор персонала"], example: "HR Evolution" },
];

/** Deduped, order-stable hints in one language. Empty when nothing matched. */
function hintsFor(companyName: string, lang: "en" | "ru"): string[] {
  const hints: string[] = [];
  for (const rule of INDUSTRY_TERMS) {
    if (!rule.term.test(companyName)) continue;
    for (const h of rule[lang]) if (!hints.includes(h)) hints.push(h);
  }
  return hints;
}

/** English industry hints implied by an Italian trade name. */
export function industryHints(companyName: string): string[] {
  return hintsFor(companyName, "en");
}

/** Russian industry hints, so a Russian-language query can reach the company. */
export function industryHintsRu(companyName: string): string[] {
  return hintsFor(companyName, "ru");
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
 * cheese than the bare name ever could. The Russian sentence does the same
 * for Cyrillic queries — voyage-3-lite is multilingual, so one vector can
 * serve both, at the cost of a slightly longer input.
 */
export function embeddingText(c: EmbeddableCompany): string {
  const sentences: string[] = [];
  const en = industryHints(c.name);
  const ru = industryHintsRu(c.name);

  sentences.push(en.length > 0 ? `${c.name} is a company in ${en.join(", ")}.` : `${c.name} is a company.`);
  if (ru.length > 0) sentences.push(`Отрасль: ${ru.join(", ")}.`);
  if (c.domain) sentences.push(`Its website is ${c.domain}.`);
  if (c.channel) sentences.push(`It was acquired through the ${c.channel.replace(/_/g, " ")} channel.`);
  if (c.stage) sentences.push(`Its current sales stage is ${c.stage}.`);

  return sentences.join(" ");
}

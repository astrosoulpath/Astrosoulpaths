export type CatalogueQuestion = { id: string; text: string; enabled: boolean };
export type CatalogueCategory = {
  id: string;
  title: string;
  enabled: boolean;
  questions: CatalogueQuestion[];
};
export type CatalogueConfig = {
  publicHelp?: {published: boolean; email: string; hours: string; responseTime: string; faqs: {id: string; question: string; answer: string; category: string; enabled: boolean}[]};
  welcome: string;
  visible: boolean;
  knowledge: string[];
  categories: CatalogueCategory[];
};
export type CatalogueSnapshot = {
  isDraft?: boolean;
  publishedRevision?: number;
  revision: number;
  editable: boolean;
  config: CatalogueConfig;
  history?: { id: string; revision: string; createdAt: string }[];
};
export function supportCataloguePayload(
  expectedRevision: number,
  config: CatalogueConfig,
) {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    !config ||
    typeof config.welcome !== "string" ||
    !config.welcome.trim() ||
    config.welcome.length > 500 ||
    typeof config.visible !== "boolean" ||
    !Array.isArray(config.categories) ||
    config.categories.length !== 3 ||
    !Array.isArray(config.knowledge)
  )
    throw new Error("Invalid support configuration");
  const categories = new Set<string>(),
    questions = new Set<string>();
  for (const c of config.categories) {
    if (
      !["payment", "consultation", "account"].includes(c.id) ||
      categories.has(c.id) ||
      typeof c.title !== "string" ||
      !c.title.trim() ||
      c.title.length > 80 ||
      typeof c.enabled !== "boolean" ||
      !Array.isArray(c.questions) ||
      c.questions.length > 30
    )
      throw new Error("Invalid category");
    categories.add(c.id);
    for (const q of c.questions) {
      if (
        typeof q.id !== "string" ||
        !q.id ||
        questions.has(q.id) ||
        typeof q.text !== "string" ||
        !q.text.trim() ||
        q.text.length > 300 ||
        typeof q.enabled !== "boolean"
      )
        throw new Error("Invalid question");
      questions.add(q.id);
    }
  }
  if (config.knowledge.some((k) => typeof k !== "string"))
    throw new Error("Invalid knowledge");
  const knowledge = config.knowledge.map((k) => k.trim()).filter(Boolean);
  if (knowledge.length > 20 || knowledge.some((k) => k.length > 1500))
    throw new Error("Invalid knowledge");
  if (config.publicHelp !== undefined) {
    const help = config.publicHelp;
    if (!help || typeof help.published !== 'boolean' || typeof help.email !== 'string' || help.email.length > 254 || (help.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(help.email)) || typeof help.hours !== 'string' || help.hours.length > 200 || typeof help.responseTime !== 'string' || help.responseTime.length > 300 || !Array.isArray(help.faqs) || help.faqs.length > 40) throw new Error('Invalid public support configuration');
    const faqIds = new Set<string>();
    for (const faq of help.faqs) {
      if (!faq || typeof faq.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(faq.id) || faqIds.has(faq.id) || typeof faq.question !== 'string' || !faq.question.trim() || faq.question.length > 200 || typeof faq.answer !== 'string' || !faq.answer.trim() || faq.answer.length > 2000 || typeof faq.enabled !== 'boolean' || !['GENERAL', 'CONSULTATION', 'PAYMENT', 'WALLET', 'ACCOUNT', 'ASTROLOGER', 'TECHNICAL', 'OTHER'].includes(faq.category)) throw new Error('Invalid public FAQ');
      faqIds.add(faq.id);
    }
  }
  return {
    expectedRevision,
    config: { ...config, welcome: config.welcome.trim(), knowledge },
  };
}
export function readSupportCatalogue(value: unknown): CatalogueSnapshot {
  const data = value as CatalogueSnapshot;
  if (!data || typeof data.editable !== "boolean")
    throw new Error("Invalid support response");
  const parsed = supportCataloguePayload(data.revision, data.config);
  return {
    revision: data.revision,
    editable: data.editable,
    isDraft: data.isDraft === true,
    publishedRevision: Number.isSafeInteger(data.publishedRevision) && data.publishedRevision! >= 0 ? data.publishedRevision : data.revision,
    config: parsed.config,
    history: Array.isArray(data.history) ? data.history : [],
  };
}

/**
 * Text normalisation for catalogue search (client-safe, no deps).
 *   "L’Oréal Paris SPF50+" → "loreal paris spf 50"
 * Case- and diacritic-insensitive; splits letter/digit runs so "spf50" matches "SPF 50".
 */

export function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

export const words = (s: string | null | undefined): string[] => norm(s).split(" ").filter(Boolean);

/** Light English stemmer: plural "s"/"es" (not "ss"). */
export function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

export const STOP = new Set([
  "for", "with", "and", "the", "of", "in", "to", "a", "an", "on", "by", "best", "buy", "online", "product", "products", "rs", "price", "india", "indian", "under",
]);

/**
 * Shopper vocabulary → catalogue vocabulary. Synonym hits score a little lower than direct hits.
 * Keys are normalised single words; values may be phrases.
 */
export const SYN: Record<string, string[]> = {
  sunscreen: ["spf", "sun"], sunblock: ["spf", "sunscreen"], spf: ["sunscreen"], sun: ["spf", "sunscreen"],
  pimple: ["acne", "salicylic", "neem"], acne: ["pimple", "salicylic"], oily: ["oil control", "salicylic", "acne"],
  perfume: ["parfum", "fragrance", "eau"], scent: ["parfum", "fragrance", "perfume"], deo: ["deodorant", "fragrance"], deodorant: ["deo"], fragrance: ["perfume", "parfum"],
  moisturiser: ["moisturising", "moisturizer", "cream", "lotion"], moisturizer: ["moisturiser", "moisturising", "cream", "lotion"],
  moisturizing: ["moisturising"], moisturising: ["moisturizing", "moisturiser"],
  cleanser: ["face wash", "cleansing"], facewash: ["face wash"], hairfall: ["hair fall"], dandruf: ["dandruff"],
  lipstick: ["lip", "matte"], lip: ["lipstick", "balm"], kohl: ["kajal"], eyeliner: ["kajal"], kajol: ["kajal"], kajal: ["kohl"],
  men: ["man", "beard", "mens"], man: ["men"], him: ["men"], mens: ["men"], her: ["women"], women: ["woman"], woman: ["women"],
  glow: ["glowing", "bright", "brightening", "vitamin c"], tan: ["de tan", "sun tan"], vitc: ["vitamin c"], growth: ["hair growth"],
  dry: ["moisturising", "nourishing"], lotion: ["body lotion"], gift: ["tbb", "originals"], free: ["tbb", "originals"],
  colour: ["color"], color: ["colour"], shampoo: ["hair wash"], conditioner: ["conditioning"], serum: ["serums"],
  oil: ["oils"], soap: ["bar", "bathing bar"], foundation: ["base"], makeup: ["make up"], fairness: ["brightening", "glow"],
};

/**
 * Tokens of a search query. A number or single letter after a word stays attached to it as a phrase
 * ("spf 50", "vitamin c", "9 to 5"), so "spf50" never matches a 50 g pack of something else. Stop words dropped.
 */
export function queryTokens(q: string): string[] {
  const out: string[] = [];
  const ws = words(q);
  ws.forEach((w, i) => {
    const prev = ws[i - 1];
    const attach = (/^\d+$/.test(w) || w.length === 1) && prev && /[a-z]/.test(prev) && prev.length > 1;
    if (attach) {
      const last = out[out.length - 1];
      if (last !== undefined && (last === prev || last.endsWith(` ${prev}`))) out[out.length - 1] = `${last} ${w}`;
      else out.push(`${prev} ${w}`);
      return;
    }
    if (!STOP.has(w) && (w.length >= 2 || /\d/.test(w))) out.push(w);
  });
  return out;
}

// English -> Russian country name translation for renaming source tags.
// Falls back to the original English name if not found, so an unmapped
// country never crashes the run — it just won't be translated yet.

export const COUNTRY_RU = {
  Belgium: "Бельгия",
  Czechia: "Чехия",
  "Czech Republic": "Чехия",
  Germany: "Германия",
  India: "Индия",
  Poland: "Польша",
  Switzerland: "Швейцария",
  "The Netherlands": "Нидерланды",
  Netherlands: "Нидерланды",
  Turkey: "Турция",
  "United States": "США",
  USA: "США",
  Russia: "Россия",
  Finland: "Финляндия",
  France: "Франция",
  "United Kingdom": "Великобритания",
  UK: "Великобритания",
  Canada: "Канада",
  Singapore: "Сингапур",
  Sweden: "Швеция",
  Norway: "Норвегия",
  Italy: "Италия",
  Spain: "Испания",
  Austria: "Австрия",
  Ireland: "Ирландия",
  Japan: "Япония",
  "South Korea": "Южная Корея",
  Ukraine: "Украина",
  Kazakhstan: "Казахстан",
  Latvia: "Латвия",
  Lithuania: "Литва",
  Estonia: "Эстония",
  Portugal: "Португалия",
  Romania: "Румыния",
  Bulgaria: "Болгария",
  Hungary: "Венгрия",
  Greece: "Греция",
  Denmark: "Дания",
  "Hong Kong": "Гонконг",
  "United Arab Emirates": "ОАЭ",
  UAE: "ОАЭ",
};

/**
 * Extracts a leading flag emoji (if present) and an English country name
 * from a decoded tag like "🇩🇪 Germany | 🌐 [*CIDR] Beeline", then returns
 * a Russian replacement tag "🇩🇪 Германия". If no known country name is
 * found, returns null so the caller can decide how to handle it.
 */
export function toRussianCountryTag(decodedTag) {
  const flagMatch = decodedTag.match(/^(\p{Regional_Indicator}{2})\s*/u);
  const flag = flagMatch ? flagMatch[1] : "";
  const rest = flagMatch ? decodedTag.slice(flagMatch[0].length) : decodedTag;

  const names = Object.keys(COUNTRY_RU).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (rest.startsWith(name)) {
      return `${flag} ${COUNTRY_RU[name]}`.trim();
    }
  }
  return null;
}

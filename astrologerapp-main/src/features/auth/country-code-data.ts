type RawCountryRecord = {
  callingCode?: string[];
  name?: {
    common?: string;
  };
};

export type CountryCodeOption = {
  code: string;
  flag: string;
  isoCode: string;
  name: string;
};

function toFlagEmoji(isoCode: string) {
  if (!/^[A-Z]{2}$/.test(isoCode)) {
    return "";
  }

  return String.fromCodePoint(
    ...isoCode.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
}

const countriesData =
  require("react-native-country-picker-modal/lib/assets/data/countries-emoji.json") as Record<
    string,
    RawCountryRecord
  >;

export const countryCodeOptions: CountryCodeOption[] = Object.entries(
  countriesData,
)
  .flatMap(([isoCode, country]) => {
    const name = country.name?.common?.trim();

    if (!name || !country.callingCode?.length) {
      return [];
    }

    return country.callingCode
      .filter((callingCode) => Boolean(callingCode))
      .map((callingCode) => ({
        code: `+${callingCode}`,
        flag: toFlagEmoji(isoCode),
        isoCode,
        name,
      }));
  })
  .sort((left, right) => {
    if (left.code === right.code) {
      return left.name.localeCompare(right.name);
    }

    return left.code.localeCompare(right.code, undefined, { numeric: true });
  });

export function findCountryCodeOption(code: string) {
  return countryCodeOptions.find((option) => option.code === code) ?? null;
}

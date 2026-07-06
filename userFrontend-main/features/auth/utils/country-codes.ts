import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export type CountryCodeOption = {
  countryCode: CountryCode;
  callingCode: string;
  name: string;
  flag: string;
};

const displayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function getCountryName(countryCode: CountryCode) {
  return displayNames?.of(countryCode) ?? countryCode;
}

function getFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export const countryCodeOptions: CountryCodeOption[] = getCountries()
  .map((countryCode) => ({
    countryCode,
    callingCode: getCountryCallingCode(countryCode),
    name: getCountryName(countryCode),
    flag: getFlagEmoji(countryCode),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

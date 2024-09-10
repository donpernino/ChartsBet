import type { Country } from "./constants";

export const getCountry = (country: Country) => {
  switch (country) {
    case "BR":
      return "Brazil";
    case "DE":
      return "Germany";
    case "ES":
      return "Spain";
    case "FR":
      return "France";
    case "IT":
      return "Italy";
    case "PT":
      return "Portugal";
    case "US":
      return "United States";
    case "WW":
      return "Worldwide";
  }
};

export const getCountryCode = (country: string) => {
  switch (country) {
    case "Brazil":
      return "BR";
    case "Germany":
      return "DE";
    case "Spain":
      return "ES";
    case "France":
      return "FR";
    case "Italy":
      return "IT";
    case "Portugal":
      return "PT";
    case "United States":
      return "US";
    case "Worldwide":
      return "WW";
  }
};

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
      return "Global";
  }
};

import { createContext, useContext, useState, type FC, type ReactNode } from "react";

import type { Country } from "../utils/constants";

interface CountryContextProps {
  selectedCountry: Country;
  setSelectedCountry: (country: Country) => void;
}

const CountryContext = createContext<CountryContextProps | undefined>(undefined);

export const CountryProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>("FR");

  return (
    <CountryContext.Provider value={{ selectedCountry, setSelectedCountry }}>
      {children}
    </CountryContext.Provider>
  );
};

export const useCountry = () => {
  const context = useContext(CountryContext);
  if (!context) {
    throw new Error("useCountry must be used within a CountryProvider");
  }
  return context;
};

import { Text } from "@chakra-ui/react";

import { FrFlag, UsFlag, BrFlag, DeFlag, EsFlag, PtFlag, ItFlag } from "../Icons";

interface CountryFlagProps {
  selectedCountry: string;
  size?: number;
}

const CountryFlag: React.FC<CountryFlagProps> = ({ selectedCountry, size = 64 }) => {
  console.log(selectedCountry);

  if (selectedCountry === "FR" || selectedCountry === "France") {
    return <FrFlag height={size} width={size} />;
  } else if (selectedCountry === "US" || selectedCountry === "United States") {
    return <UsFlag height={size} width={size} />;
  } else if (selectedCountry === "BR" || selectedCountry === "Brazil") {
    return <BrFlag height={size} width={size} />;
  } else if (selectedCountry === "DE" || selectedCountry === "Germany") {
    return <DeFlag height={size} width={size} />;
  } else if (selectedCountry === "ES" || selectedCountry === "Spain") {
    return <EsFlag height={size} width={size} />;
  } else if (selectedCountry === "PT" || selectedCountry === "Portugal") {
    return <PtFlag height={size} width={size} />;
  } else if (selectedCountry === "IT" || selectedCountry === "Italy") {
    return <ItFlag height={size} width={size} />;
  } else if (selectedCountry === "WW" || selectedCountry === "Worldwide") {
    return <Text>🌍</Text>;
  }

  return null;
};

export default CountryFlag;

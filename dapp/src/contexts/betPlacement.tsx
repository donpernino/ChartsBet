import React, { createContext, useContext, type ReactNode } from "react";

import { ethers } from "ethers";

import ChartsBetJson from "../../../contract/artifacts/contracts/ChartsBet.sol/ChartsBet.json";

interface BetPlacementContextType {
  checkBetPlaced: (address: string, country: string) => Promise<boolean>;
}

const BetPlacementContext = createContext<BetPlacementContextType | undefined>(undefined);

export const useBetPlacement = () => {
  const context = useContext(BetPlacementContext);
  if (!context) {
    throw new Error("useBetPlacement must be used within a BetPlacementProvider");
  }
  return context;
};

interface BetPlacementProviderProps {
  children: ReactNode;
}

export const BetPlacementProvider: React.FC<BetPlacementProviderProps> = ({ children }) => {
  const checkBetPlaced = async (address: string, country: string): Promise<boolean> => {
    if (!address || !country) return false;
    try {
      const betContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      if (!betContractAddress) {
        throw new Error("Contract address is not properly configured.");
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const betContract = new ethers.Contract(betContractAddress, ChartsBetJson.abi, provider);
      const encodedCountry = ethers.encodeBytes32String(country);
      return await betContract.hasBetPlaced(encodedCountry, address);
    } catch (error) {
      console.error("Error checking if bet is placed:", error);
      return false;
    }
  };

  return (
    <BetPlacementContext.Provider value={{ checkBetPlaced }}>
      {children}
    </BetPlacementContext.Provider>
  );
};

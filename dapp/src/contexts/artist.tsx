import { createContext, useContext, useState, type FC, type ReactNode } from "react";

interface ArtistContextProps {
  selectedArtist: {
    artist: string;
    odds: number;
  };
  setSelectedArtist: (artist: { artist: string; odds: number }) => void;
}

const ArtistContext = createContext<ArtistContextProps | undefined>(undefined);

export const ArtistProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedArtist, setSelectedArtist] = useState(null);

  return (
    <ArtistContext.Provider value={{ selectedArtist, setSelectedArtist }}>
      {children}
    </ArtistContext.Provider>
  );
};

export const useArtist = () => {
  const context = useContext(ArtistContext);
  if (!context) {
    throw new Error("useArtist must be used within a ArtistProvider");
  }
  return context;
};

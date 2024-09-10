"use client";

import { type FC, useEffect, useState } from "react";

import { Box, Container, Select, Text } from "@chakra-ui/react";

import CountryFlag from "../CountryFlag/CountryFlag";
import { TrackCard } from "../TrackCard";
import { useCountry } from "@/contexts/country";
import type { Leaderboard } from "@/types/leaderboard";
import { countries } from "@/utils/constants";
import { getCountry } from "@/utils/getCountryName";

const LeaderboardList: FC = () => {
  const { selectedCountry, setSelectedCountry } = useCountry();
  const [leaderboardData, setLeaderboardData] = useState<Leaderboard | null>(null);
  const todaysDate = new Date().toLocaleDateString();

  useEffect(() => {
    fetch(`http://localhost:8080/leaderboard/${selectedCountry}`)
      .then((res) => res.json())
      .then((data) => {
        setLeaderboardData(data);
      });
  }, [selectedCountry]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCountry(e.target.value);
  };

  return (
    <>
      <Container maxW="1200px" pt={12} pb={48} gap="4" display="flex" flexDirection="column">
        <Box display="flex" flexDirection="column" gap="0">
          <Box
            display="flex"
            flexDirection="row"
            alignItems="center"
            fontSize="4xl"
            fontWeight="bold"
            gap="3"
            mr="auto"
          >
            <CountryFlag selectedCountry={selectedCountry} />
            <Text whiteSpace="nowrap">Daily Top Songs</Text>
            <Select
              value={selectedCountry}
              fontSize="4xl"
              fontWeight="bold"
              p="0"
              border="0"
              height="64px"
              rounded="0"
              cursor="pointer"
              borderBottom="2px"
              borderColor="black"
              borderStyle="dotted"
              onChange={handleCountryChange}
            >
              {countries.map((country, index) => {
                return (
                  <option value={country} key={index}>
                    {getCountry(country)}
                  </option>
                );
              })}
            </Select>
          </Box>
        </Box>
        <Text fontSize="lg" mb={3} color="gray.500">
          {todaysDate}
        </Text>
        {leaderboardData?.leaderboard.map((track, index) => {
          return <TrackCard key={index} track={track} />;
        })}
      </Container>
    </>
  );
};

export default LeaderboardList;

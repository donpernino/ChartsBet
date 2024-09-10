"use client";

import { type FC } from "react";

import { Box, Container, Heading, Text } from "@chakra-ui/react";

import { BetCard } from "../BetCard";
import CountryFlag from "../CountryFlag/CountryFlag";

const BetsList: FC = () => {
  const userBets = JSON.parse(localStorage.getItem("bets") || "[]");
  let userBetsByCountry = userBets.reduce((acc, bet) => {
    const country = bet.country;

    if (!acc[country]) {
      acc[country] = [];
    }

    acc[country].push(bet);

    return acc;
  }, {});
  userBetsByCountry = Object.values(userBetsByCountry);

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
            <Text>My bets</Text>
          </Box>
        </Box>
        {userBetsByCountry.map((countryBets, countryIndex) => {
          return (
            <Box key={countryIndex} mb="20">
              <Heading
                as="h3"
                display="flex"
                flexDirection="row"
                alignItems="center"
                fontSize="xl"
                fontWeight="bold"
                gap="3"
                mr="auto"
                mb="4"
              >
                <CountryFlag selectedCountry={countryBets[0].country} size={32} />
                <Text whiteSpace="nowrap">Bets for {countryBets[0].country}</Text>
              </Heading>
              {countryBets.map(({ title, amount, country, date, odds }, index) => (
                <BetCard
                  key={index}
                  artist={title}
                  amount={amount}
                  country={country}
                  date={date}
                  odds={odds}
                />
              ))}
            </Box>
          );
        })}
      </Container>
    </>
  );
};

export default BetsList;

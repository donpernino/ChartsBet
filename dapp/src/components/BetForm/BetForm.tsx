"use client";

import { CheckIcon } from "@chakra-ui/icons";
import { Box, Button, Container, FormControl, FormLabel, Input, Text } from "@chakra-ui/react";

import { useArtist } from "@/contexts/artist";
import { useCountry } from "@/contexts/country";
import { getCountry } from "@/utils/getCountryName";

const BetForm = () => {
  const { selectedCountry } = useCountry();
  const { selectedArtist, setSelectedArtist } = useArtist();
  const tomorrowsDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toLocaleDateString();

  const handleBetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedArtist(event.target.value);
  };

  console.log(selectedArtist);

  return (
    <Container
      position="fixed"
      maxW="1200px"
      bg="white"
      p="8"
      bottom="4"
      left="50%"
      transform={["translateX(-50%)"]}
      shadow="xl"
      rounded="12"
    >
      <FormControl flexDirection="column">
        <FormLabel
          fontSize="lg"
          mb="3"
          color="black"
          fontWeight="600"
          display="flex"
          alignItems="center"
        >
          <Text>Who will be</Text>
          <Text rounded="8" bg="gray.100" p="1.5" mx="1.5">
            {getCountry(selectedCountry)}
          </Text>
          <Text>#1 artist tommorow ({tomorrowsDate})?</Text>
        </FormLabel>
        <Box display="flex" flexDirection="row" gap="3">
          <Input
            placeholder="Enter an artist name or pick one from the leaderboard"
            size="lg"
            color="black"
            value={selectedArtist}
            onChange={handleBetChange}
          />
          <Button size="lg" variant="solid" leftIcon={<CheckIcon />}>
            Bet
          </Button>
        </Box>
      </FormControl>
    </Container>
  );
};

export default BetForm;

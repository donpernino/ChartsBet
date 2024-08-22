"use client";

import { useState } from "react";

import { CheckIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
} from "@chakra-ui/react";

import { useArtist } from "@/contexts/artist";
import { useCountry } from "@/contexts/country";
import { getCountry } from "@/utils/getCountryName";

const BetForm = () => {
  const { selectedCountry } = useCountry();
  const { selectedArtist, setSelectedArtist } = useArtist();
  const [betAmount, setBetAmount] = useState(null);
  const tomorrowsDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toLocaleDateString();

  const handleBetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedArtist(event.target.value);
  };

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
          mb="2"
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
        <Box display="flex" flexDirection="column" gap="3">
          <Input
            placeholder="Enter an artist name or pick one from the leaderboard"
            size="lg"
            color="black"
            value={selectedArtist}
            onChange={handleBetChange}
          />
        </Box>
        <FormLabel fontSize="lg" mt="4" mb="2" fontWeight="600">
          How much do you want to bet? (in ETH)
        </FormLabel>
        <NumberInput defaultValue={0.2} precision={2} step={0.2} size="lg" color="black">
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Button mt="6" size="lg" variant="solid" leftIcon={<CheckIcon />}>
          Bet
        </Button>
      </FormControl>
    </Container>
  );
};

export default BetForm;

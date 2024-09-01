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
  Tooltip,
  Flex,
  Spacer,
} from "@chakra-ui/react";

import { useArtist } from "@/contexts/artist";
import { useCountry } from "@/contexts/country";
import { getCountry } from "@/utils/getCountryName";
import { getFormattedOdds } from "@/utils/getFormattedOdds";

const BetForm = () => {
  const { selectedCountry } = useCountry();
  const { selectedArtist, setSelectedArtist } = useArtist();
  const [betAmount, setBetAmount] = useState(null);
  const tomorrowsDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toLocaleDateString();

  const handleBetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedArtist(null);
  };

  return (
    <Container
      position="fixed"
      maxW="1200px"
      p="4"
      bottom="4"
      left="50%"
      transform="translateX(-50%)"
      shadow="xl"
      rounded="12"
      bg="rgba(255, 255, 255, 0.6)"
      backdropFilter="blur(10px)"
    >
      <FormControl as={Flex} flexDirection="column" alignItems="center">
        <FormLabel
          fontSize="lg"
          color="black"
          fontWeight="600"
          display="flex"
          alignItems="center"
          mb="4"
          textAlign="center"
        >
          <Text>Who will be</Text>
          <Text rounded="8" bg="gray.100" p="1.5" mx="1.5">
            {getCountry(selectedCountry)}
          </Text>
          <Text>#1 artist tomorrow ({tomorrowsDate})?</Text>
        </FormLabel>

        <Flex flexDirection={["column", "row"]} alignItems="center" w="100%" mb="4">
          <Input
            placeholder="Enter an artist name or pick one from the leaderboard"
            size="md"
            color="black"
            value={selectedArtist?.artist}
            onChange={handleBetChange}
            flex="1"
            mr={[0, 4]}
            mb={[3, 0]}
          />

          <FormLabel fontSize="lg" fontWeight="600" mb={[2, 0]} mr={[0, 2]}>
            Bet Amount (ETH)
          </FormLabel>
          <NumberInput defaultValue={0.2} precision={2} step={0.2} size="md" color="black" flex="1">
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </Flex>

        <Flex flexDirection="row" alignItems="center" justifyContent="space-between" w="100%">
          {selectedArtist && (
            <Tooltip label="Current betting odds" aria-label="Betting odds">
              <Box
                bg="green.50"
                color="green.700"
                px="3"
                py="1"
                borderRadius="full"
                fontWeight="medium"
                textAlign="center"
                mr={[0, 4]}
              >
                {getFormattedOdds(selectedArtist?.odds)}x
              </Box>
            </Tooltip>
          )}
          <Spacer />
          <Button size="md" variant="solid" leftIcon={<CheckIcon />}>
            Bet
          </Button>
        </Flex>
      </FormControl>
    </Container>
  );
};

export default BetForm;

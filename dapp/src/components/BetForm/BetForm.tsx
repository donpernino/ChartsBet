"use client";

import React, { useState, useEffect } from "react";

import { CheckIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Text,
  Tooltip,
  Flex,
  Spacer,
  useToast,
} from "@chakra-ui/react";
import { ethers } from "ethers";
import { ErrorDecoder } from "ethers-decode-error";
import { useAccount, useWalletClient } from "wagmi";

import ChartsBetJson from "../../../../contract/artifacts/contracts/ChartsBet.sol/ChartsBet.json";
import { useArtist } from "@/contexts/artist";
import { useCountry } from "@/contexts/country";
import { getCountry } from "@/utils/getCountryName";
import { getFormattedOdds } from "@/utils/getFormattedOdds";

const errorDecoder = ErrorDecoder.create();

const BetForm: React.FC = () => {
  const { selectedCountry } = useCountry();
  const { selectedArtist, setSelectedArtist } = useArtist();
  const [betAmount, setBetAmount] = useState<string>("0.01");
  const [ethBalance, setEthBalance] = useState<string>("0");
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    if (address) {
      updateEthBalance();
    }
  }, [address]);

  const updateEthBalance = async () => {
    if (!address) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(address);
      setEthBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error("Error fetching ETH balance:", error);
    }
  };

  const handleBetChange = () => setSelectedArtist(null);

  const handleBet = async () => {
    if (!selectedArtist || !betAmount || !walletClient || !address) {
      toast({
        title: "Betting error",
        description: "Please select an artist, enter a bet amount, and connect your wallet.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const betContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!betContractAddress) {
      toast({
        title: "Configuration Error",
        description: "Contract address is not properly configured.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const betContract = new ethers.Contract(betContractAddress, ChartsBetJson.abi, signer);

      const betAmountWei = ethers.parseEther(betAmount);
      const maxBet = await betContract.MAX_BET();
      if (betAmountWei > maxBet) {
        throw new Error("Bet amount exceeds the maximum allowed");
      }

      const balance = await provider.getBalance(address);
      if (balance < betAmountWei) {
        throw new Error("Insufficient ETH balance");
      }

      const encodedCountry = ethers.encodeBytes32String(selectedCountry);
      const encodedArtist = ethers.encodeBytes32String(selectedArtist.artist);

      const poolInfo = await betContract.getPoolInfo(encodedCountry);
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime < poolInfo[0] || currentTime >= poolInfo[1]) {
        throw new Error("Betting pool is not open");
      }

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice;

      const gasEstimate = await betContract.placeBet.estimateGas(encodedCountry, encodedArtist, {
        value: betAmountWei,
      });
      const gasLimit = (gasEstimate * 120n) / 100n;

      const betTx = await betContract.placeBet(encodedCountry, encodedArtist, {
        gasPrice,
        gasLimit,
        value: betAmountWei,
      });

      const receipt = await betTx.wait();
      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      toast({
        title: "Bet placed",
        description: `Your bet of ${betAmount} ETH on ${selectedArtist.artist} has been placed successfully.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      updateEthBalance();
    } catch (error) {
      console.error("Error placing bet:", error);
      let errorMessage = "An error occurred while placing your bet. Please try again.";

      if (error instanceof Error) {
        if (error.message.includes("insufficient funds")) {
          errorMessage =
            "Insufficient funds to complete the transaction. Please check your balance and try again.";
        } else if (error.message.includes("user rejected")) {
          errorMessage =
            "Transaction was rejected. Please try again and confirm the transaction in your wallet.";
        } else if (error.message.includes("execution reverted")) {
          errorMessage =
            "Transaction reverted. This could be due to contract conditions not being met.";
        }
      }

      const decodedError = await errorDecoder.decode(error);
      if (decodedError.reason) {
        errorMessage = `Error: ${decodedError.reason}`;
      }

      toast({
        title: "Betting error",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
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
          <Text>#1 artist tomorrow?</Text>
        </FormLabel>

        <Flex flexDirection={["column", "row"]} alignItems="center" w="100%" mb="4">
          <Input
            placeholder="Enter an artist name or pick one from the leaderboard"
            size="md"
            color="black"
            value={selectedArtist?.artist || ""}
            onChange={handleBetChange}
            flex="1"
            mr={[0, 4]}
            mb={[3, 0]}
          />

          <FormLabel fontSize="lg" fontWeight="600" mb={[2, 0]} mr={[0, 2]}>
            Bet Amount (ETH)
          </FormLabel>
          <NumberInput
            precision={4}
            step={0.01}
            min={0}
            max={parseFloat(ethBalance)}
            size="md"
            color="black"
            flex="1"
            value={betAmount}
            onChange={setBetAmount}
          >
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
          <Text mr="4">Balance: {parseFloat(ethBalance).toFixed(4)} ETH</Text>
          <Button size="md" variant="solid" leftIcon={<CheckIcon />} onClick={handleBet}>
            Bet
          </Button>
        </Flex>
      </FormControl>
    </Container>
  );
};

export default BetForm;

"use client";

import React, { useState, useEffect } from "react";

import { CheckIcon, InfoIcon } from "@chakra-ui/icons";
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
  Progress,
} from "@chakra-ui/react";
import { ethers } from "ethers";
import { ErrorDecoder } from "ethers-decode-error";
import { useAccount, useWalletClient } from "wagmi";

import ChartsBetJson from "../../../../contract/artifacts/contracts/ChartsBet.sol/ChartsBet.json";
import { useArtist } from "@/contexts/artist";
import { useBetPlacement } from "@/contexts/betPlacement";
import { useCountry } from "@/contexts/country";
import { getCountry } from "@/utils/getCountryName";
import { getFormattedOdds } from "@/utils/getFormattedOdds";

const errorDecoder = ErrorDecoder.create();

interface BetInfo {
  title: string;
  amount: string;
  country: string;
  date: string;
  odds: string;
}

const BetForm: React.FC = () => {
  const { selectedCountry } = useCountry();
  const { selectedArtist, setSelectedArtist } = useArtist();
  const { checkBetPlaced } = useBetPlacement();
  const [betAmount, setBetAmount] = useState<string>("0.01");
  const [ethBalance, setEthBalance] = useState<string>("0");
  const [hasBetPlaced, setHasBetPlaced] = useState<boolean>(false);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    if (address) {
      updateEthBalance();
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      updateBetPlacedStatus();
    }
  }, [address, selectedCountry]);

  useEffect(() => {
    const fetchPoolInfo = async () => {
      if (!selectedCountry) return;

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

        const encodedCountry = ethers.encodeBytes32String(selectedCountry);
        const poolInfo = await betContract.getPoolInfo(encodedCountry);
        setPoolInfo(poolInfo);

        // Log poolInfo in a human-readable format
        const readablePoolInfo = {
          openingTime: new Date(Number(poolInfo[0]) * 1000).toLocaleString(),
          scheduledClosingTime: new Date(Number(poolInfo[1]) * 1000).toLocaleString(),
          actualClosingTime: new Date(Number(poolInfo[2]) * 1000).toLocaleString(),
          closed: poolInfo[3],
          totalBets: poolInfo[4].toString(),
          totalAmount: ethers.formatEther(poolInfo[5]) + " ETH",
        };

        console.log("Pool Info:", readablePoolInfo);
      } catch (error) {
        console.error("Error fetching pool info:", error);
        toast({
          title: "Error",
          description: "Failed to load betting pool information.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    };

    fetchPoolInfo();

    // Set up periodic refresh
    const intervalId = setInterval(fetchPoolInfo, 60000); // Refresh every minute

    return () => clearInterval(intervalId);
  }, [selectedCountry, toast]);

  useEffect(() => {
    if (poolInfo) {
      const timer = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const closing = Number(poolInfo[1]);
        const difference = closing - now;

        if (difference > 0) {
          const hours = Math.floor(difference / 3600);
          const minutes = Math.floor((difference % 3600) / 60);
          const seconds = difference % 60;
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeLeft("Closed");
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [poolInfo]);

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

  const updateBetPlacedStatus = async () => {
    if (address && selectedCountry) {
      const betPlaced = await checkBetPlaced(address, selectedCountry);
      setHasBetPlaced(betPlaced);
    }
  };

  const handleBetChange = () => setSelectedArtist(null);

  const storeBetInfo = (betInfo: BetInfo) => {
    const existingBets = JSON.parse(localStorage.getItem("bets") || "[]");
    existingBets.push(betInfo);
    localStorage.setItem("bets", JSON.stringify(existingBets));
  };

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

    if (!poolInfo) {
      toast({
        title: "Pool info error",
        description: "Betting pool information is not loaded.",
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

      // Check if the current pool is closed
      if (poolInfo[3]) {
        // Refresh pool info
        const encodedCountry = ethers.encodeBytes32String(selectedCountry);
        const freshPoolInfo = await betContract.getPoolInfo(encodedCountry);
        setPoolInfo(freshPoolInfo);

        // If the new pool is also closed, throw an error
        if (freshPoolInfo[3]) {
          throw new Error("Betting pool is currently closed");
        }
      }

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

      toast({
        title: "Bet Pending",
        description: "Your bet is being processed. Please wait for confirmation.",
        status: "info",
        duration: 5000,
        isClosable: true,
      });

      const receipt = await betTx.wait();
      if (receipt.status === 1) {
        // Store bet information in local storage
        const betInfo: BetInfo = {
          title: `Bet on ${selectedArtist.artist}`,
          amount: betAmount,
          country: getCountry(selectedCountry),
          date: new Date().toISOString(),
          odds: selectedArtist.odds,
        };
        storeBetInfo(betInfo);

        toast({
          title: "Bet Placed",
          description: `Your bet of ${betAmount} ETH on ${selectedArtist.artist} has been placed successfully.`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });

        updateBetPlacedStatus();
        updateEthBalance();
      } else {
        throw new Error("Transaction failed");
      }
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
        } else if (error.message.includes("Betting pool is currently closed")) {
          errorMessage = "The betting pool for today is currently closed. Please try again later.";
        }
      }

      const decodedError = await errorDecoder.decode(error);
      if (decodedError.reason) {
        errorMessage = `Error: ${decodedError.reason}`;
      }

      toast({
        title: "Betting Error",
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
            placeholder="Pick an artist from the leaderboard"
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

        <Flex
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          w="100%"
          mt="4"
        >
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
          <Button
            size="md"
            variant="solid"
            leftIcon={<CheckIcon />}
            onClick={handleBet}
            isDisabled={hasBetPlaced || (poolInfo && poolInfo[3])}
          >
            {hasBetPlaced ? "Bet Already Placed" : poolInfo && poolInfo[3] ? "Pool Closed" : "Bet"}
          </Button>
        </Flex>

        {poolInfo && (
          <Box mt="4" w="100%">
            <Flex justifyContent="space-between" alignItems="center">
              <Text fontSize="sm">Pool closes in: {timeLeft}</Text>
              <Tooltip label="Total amount bet in this pool" aria-label="Total pool amount">
                <Flex alignItems="center">
                  <InfoIcon mr="2" />
                  <Text fontSize="sm">Pool: {ethers.formatEther(poolInfo[5])} ETH</Text>
                </Flex>
              </Tooltip>
            </Flex>
            <Progress
              value={(Number(poolInfo[4]) / 100) * 100}
              size="sm"
              colorScheme="green"
              mt="2"
            />
          </Box>
        )}
      </FormControl>
    </Container>
  );
};

export default BetForm;

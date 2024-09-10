"use client";

import React, { useState, useEffect } from "react";

import { CheckIcon, RepeatIcon } from "@chakra-ui/icons";
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { ethers } from "ethers";
import { ErrorDecoder } from "ethers-decode-error";
import type { DecodedError } from "ethers-decode-error";
import { useAccount, useWalletClient } from "wagmi";

import ChartsBetJson from "../../../../contract/artifacts/contracts/ChartsBet.sol/ChartsBet.json";
import ChartsBetTokenJson from "../../../../contract/artifacts/contracts/ChartsBetToken.sol/ChartsBetToken.json";
import { useArtist } from "@/contexts/artist";
import { useCountry } from "@/contexts/country";
import { getCountry } from "@/utils/getCountryName";
import { getFormattedOdds } from "@/utils/getFormattedOdds";

const errorDecoder = ErrorDecoder.create();

const BetForm: React.FC = () => {
  const { selectedCountry } = useCountry();
  const { selectedArtist, setSelectedArtist } = useArtist();
  const [betAmount, setBetAmount] = useState<string>("");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [buyAmount, setBuyAmount] = useState<string>("1");
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    if (address) {
      updateTokenBalance();
      updateAllowance();
    }
  }, [address]);

  const updateTokenBalance = async () => {
    if (!address) return;

    const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
    if (!tokenContractAddress) {
      console.error("TOKEN_CONTRACT_ADDRESS is not set");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenContractAddress,
        ChartsBetTokenJson.abi,
        signer,
      );

      const balance = await tokenContract.balanceOf(address);
      const formattedBalance = ethers.formatUnits(balance, 18);
      setTokenBalance(formattedBalance);
      console.log("Token balance updated:", formattedBalance);
    } catch (error) {
      console.error("Error fetching token balance:", error);
    }
  };

  const updateAllowance = async () => {
    if (!address) return;

    const betContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;

    if (!betContractAddress || !tokenContractAddress) {
      console.error("Contract addresses are not properly configured.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenContractAddress,
        ChartsBetTokenJson.abi,
        signer,
      );

      const currentAllowance = await tokenContract.allowance(address, betContractAddress);
      setAllowance(currentAllowance);
      console.log("Current allowance:", ethers.formatEther(currentAllowance));
    } catch (error) {
      console.error("Error updating allowance:", error);
    }
  };

  const handleBetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedArtist(null);
  };

  const handleBetAmountChange = (valueString: string) => setBetAmount(valueString);
  const handleBuyAmountChange = (valueString: string) => setBuyAmount(valueString);

  const handleApprove = async () => {
    const betContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;

    if (!betContractAddress || !tokenContractAddress) {
      toast({
        title: "Configuration Error",
        description: "Contract addresses are not properly configured.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenContractAddress,
        ChartsBetTokenJson.abi,
        signer,
      );

      const approveAmount = ethers.parseEther("1000000"); // Approve a large amount
      const approveTx = await tokenContract.approve(betContractAddress, approveAmount);
      await approveTx.wait();

      toast({
        title: "Approval Successful",
        description: "Token approval completed successfully.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      await updateAllowance();
    } catch (error) {
      console.error("Error approving tokens:", error);
      toast({
        title: "Approval Error",
        description: "An error occurred while approving tokens. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleBet = async () => {
    if (!selectedArtist || !betAmount) {
      toast({
        title: "Betting error",
        description: "Please select an artist and enter a bet amount.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    if (!walletClient || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to place a bet.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const betContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;

    console.log("Bet Contract Address:", betContractAddress);
    console.log("Token Contract Address:", tokenContractAddress);

    if (!betContractAddress || !tokenContractAddress) {
      toast({
        title: "Configuration Error",
        description: "Contract addresses are not properly configured.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const betContract = new ethers.Contract(betContractAddress, ChartsBetJson.abi, signer);
    const tokenContract = new ethers.Contract(tokenContractAddress, ChartsBetTokenJson.abi, signer);

    try {
      console.log("Connected to bet contract:", betContractAddress);
      console.log("Connected to token contract:", tokenContractAddress);

      // Get the network
      const network = await provider.getNetwork();
      console.log("Connected to network:", network.name, "Chain ID:", network.chainId);

      // Convert bet amount to Wei
      const betAmountWei = ethers.parseEther(betAmount);
      console.log("Bet amount in Wei:", betAmountWei);

      // Check if the bet amount exceeds the maximum allowed
      const maxBet = await betContract.MAX_BET();
      console.log("Maximum bet allowed:", ethers.formatEther(maxBet));
      if (betAmountWei > maxBet) {
        throw new Error("Bet amount exceeds the maximum allowed");
      }

      // Check token balance
      const balance = await tokenContract.balanceOf(address);
      console.log("Token balance:", ethers.formatEther(balance));
      if (balance < betAmountWei) {
        throw new Error("Insufficient token balance");
      }

      // Check allowance
      if (allowance < betAmountWei) {
        throw new Error("Insufficient token allowance. Please approve more tokens.");
      }

      // Encode bet parameters
      const encodedCountry = ethers.encodeBytes32String(selectedCountry);
      const encodedArtist = ethers.encodeBytes32String(selectedArtist.artist);
      console.log("Encoded country:", encodedCountry);
      console.log("Encoded artist:", encodedArtist);

      // Get pool info before placing bet
      const poolInfo = await betContract.getPoolInfo(encodedCountry);
      console.log("Pool Info:", poolInfo);

      // Check if the pool is open
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime < poolInfo[0] || currentTime >= poolInfo[1]) {
        throw new Error("Betting pool is not open");
      }

      console.log("Placing bet...");

      // Get the current gas price using getGasPrice() as a fallback
      let gasPrice;
      try {
        const feeData = await provider.getFeeData();
        gasPrice = feeData.gasPrice;
      } catch (feeError) {
        console.warn("Error getting fee data, falling back to getGasPrice:", feeError);
        gasPrice = (await provider.getFeeData()).gasPrice;
      }
      if (!gasPrice) {
        throw new Error("Unable to get gas price");
      }
      console.log("Current gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

      // Estimate gas for the transaction
      let gasEstimate;
      try {
        gasEstimate = await betContract.placeBet.estimateGas(
          encodedCountry,
          encodedArtist,
          betAmountWei,
        );
        console.log("Estimated gas:", gasEstimate);
      } catch (estimateError) {
        console.error("Error estimating gas:", estimateError);
        // If gas estimation fails, use a default value
        gasEstimate = 300000n; // Adjust this value based on your contract's typical gas usage
        console.log("Using default gas estimate:", gasEstimate);
      }

      // Add a 20% buffer to the gas estimate
      const gasLimit = (gasEstimate * 120n) / 100n;

      console.log("Sending transaction with parameters:", {
        gasPrice: gasPrice,
        gasLimit: gasLimit,
        encodedCountry,
        encodedArtist,
        betAmountWei: betAmountWei,
      });

      const betTx = await betContract.placeBet(encodedCountry, encodedArtist, betAmountWei, {
        gasPrice: gasPrice,
        gasLimit: gasLimit,
      });

      console.log("Bet transaction sent:", betTx.hash);
      const receipt = await betTx.wait();
      console.log("Bet transaction receipt:", receipt);

      if (receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      toast({
        title: "Bet placed",
        description: `Your bet of ${betAmount} CBT on ${selectedArtist.artist} has been placed successfully.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      updateTokenBalance();
      updateAllowance();
    } catch (error) {
      console.error("Error placing bet:", error);
      let errorMessage = "An error occurred while placing your bet. Please try again.";

      if (error instanceof Error) {
        console.error("Error message:", error.message);
        if ("reason" in error) console.error("Error reason:", (error as any).reason);
        if ("code" in error) console.error("Error code:", (error as any).code);
        if ("data" in error) console.error("Error data:", (error as any).data);

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

      const decodedError: DecodedError = await errorDecoder.decode(error);
      if (decodedError.reason) {
        console.log(`Decoded error reason: ${decodedError.reason}`);
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

  const handleBuyCBT = async () => {
    if (!walletClient || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to buy CBT.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const tokenContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
    if (!tokenContractAddress) {
      console.error("TOKEN_CONTRACT_ADDRESS is not set");
      toast({
        title: "Configuration Error",
        description:
          "The token contract address is not properly configured. Please contact support.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenContractAddress,
        ChartsBetTokenJson.abi,
        signer,
      );

      const ethAmount = ethers.parseEther(buyAmount);

      console.log("Buying CBT...");
      console.log("ETH amount:", ethers.formatEther(ethAmount), "ETH");

      // Get the current gas price
      const gasPrice = (await provider.getFeeData()).gasPrice;
      console.log("Current gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");

      // Estimate gas for the transaction
      const gasEstimate = await tokenContract.buyTokens.estimateGas({ value: ethAmount });
      console.log("Estimated gas:", gasEstimate);

      // Add a 20% buffer to the gas estimate
      const gasLimit = (gasEstimate * 120n) / 100n;

      const tx = await tokenContract.buyTokens({
        value: ethAmount,
        gasPrice: gasPrice,
        gasLimit: gasLimit,
      });

      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt?.blockNumber);

      toast({
        title: "CBT purchased",
        description: `Successfully bought ${Number(buyAmount) * 100} CBT for ${buyAmount} ETH. Transaction hash: ${tx.hash}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      updateTokenBalance();
      onClose();
    } catch (error) {
      console.error("Error buying CBT:", error);
      let errorMessage = "An unexpected error occurred while buying CBT. Please try again.";
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        if ("reason" in error) console.error("Error reason:", (error as any).reason);
        if ("code" in error) console.error("Error code:", (error as any).code);
        if ("data" in error) console.error("Error data:", (error as any).data);

        if (error.message.includes("insufficient funds")) {
          errorMessage =
            "Insufficient funds to complete the purchase. Please check your ETH balance and try again.";
        } else if (error.message.includes("user rejected")) {
          errorMessage =
            "Transaction was rejected. Please try again and confirm the transaction in your wallet.";
        }
      }

      const decodedError: DecodedError = await errorDecoder.decode(error);
      if (decodedError.reason) {
        console.log(`Decoded error reason: ${decodedError.reason}`);
        errorMessage = `Error: ${decodedError.reason}`;
      }

      toast({
        title: "Purchase error",
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
            Bet Amount (CBT)
          </FormLabel>
          <NumberInput
            defaultValue={1}
            precision={2}
            step={1}
            min={0}
            max={parseFloat(tokenBalance)}
            size="md"
            color="black"
            flex="1"
            value={betAmount}
            onChange={handleBetAmountChange}
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
          <Text mr="4">Balance: {parseFloat(tokenBalance).toFixed(2)} CBT</Text>
          <Button size="sm" variant="outline" leftIcon={<RepeatIcon />} onClick={onOpen} mr="2">
            Buy CBT
          </Button>
          {allowance < (betAmount ? ethers.parseEther(betAmount) : 0n) ? (
            <Button size="md" variant="solid" leftIcon={<CheckIcon />} onClick={handleApprove}>
              Approve CBT
            </Button>
          ) : (
            <Button size="md" variant="solid" leftIcon={<CheckIcon />} onClick={handleBet}>
              Bet
            </Button>
          )}
        </Flex>
      </FormControl>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Buy ChartsBetTokens (CBT)</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb="4">1 ETH = 100 CBT</Text>
            <FormControl>
              <FormLabel>Amount of ETH to spend</FormLabel>
              <NumberInput
                value={buyAmount}
                onChange={handleBuyAmountChange}
                min={0.01}
                step={0.01}
                precision={2}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
            <Text mt="2">You will receive: {parseFloat(buyAmount) * 100} CBT</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleBuyCBT}>
              Buy CBT
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default BetForm;

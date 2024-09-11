import React, { useState, useEffect } from "react";
import { Box, Button, Card, CardBody, CardFooter, Text, Tooltip, useToast } from "@chakra-ui/react";
import { ethers } from "ethers";
import { ErrorDecoder } from "ethers-decode-error";
import { useAccount, useWalletClient } from "wagmi";

import ChartsBetJson from "../../../../contract/artifacts/contracts/ChartsBet.sol/ChartsBet.json";
import { getCountryCode } from "@/utils/getCountryName";

const errorDecoder = ErrorDecoder.create();

type BetCardProps = {
  artist: string;
  odds: string;
  amount: string;
  date: string;
  country: string;
};

const BetCard: React.FC<BetCardProps> = ({ artist, odds, amount, date, country }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [loadingPoolInfo, setLoadingPoolInfo] = useState(true);
  const [pendingPayout, setPendingPayout] = useState<string>("0");
  const [currentBlockTime, setCurrentBlockTime] = useState<number>(0);
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const formattedDate = new Date(date).toLocaleDateString();
  const formattedTime = new Date(date).toLocaleTimeString();

  // Fetch pool info, pending payout, and current block time
  useEffect(() => {
    const fetchPoolInfoAndPayout = async () => {
      setLoadingPoolInfo(true);
      if (!address || !walletClient) {
        setLoadingPoolInfo(false);
        return;
      }

      const betContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      if (!betContractAddress) {
        console.error("Contract address is not properly configured.");
        setLoadingPoolInfo(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const betContract = new ethers.Contract(betContractAddress, ChartsBetJson.abi, provider);

        const encodedCountry = ethers.encodeBytes32String(getCountryCode(country));

        // Fetch current day from the contract
        const currentDay = await betContract.currentDay();

        // Fetch pool info for the specific country and current day
        const info = await betContract.dailyPools(encodedCountry, currentDay);
        setPoolInfo(info);

        // Fetch pending payout for the user
        const payout = await betContract.pendingPayouts(address);
        setPendingPayout(ethers.formatEther(payout));

        // Fetch the current block timestamp
        const block = await provider.getBlock("latest");
        setCurrentBlockTime(block.timestamp * 1000); // Convert to milliseconds
      } catch (error) {
        console.error("Error fetching pool info or payout:", error);
        toast({
          title: "Error",
          description: "Failed to load pool information or pending payout.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoadingPoolInfo(false);
      }
    };

    fetchPoolInfoAndPayout();
  }, [address, walletClient, country, toast]);

  const handleSettleBet = async () => {
    if (!address || !walletClient) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to settle the bet.",
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

    setIsLoading(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const betContract = new ethers.Contract(betContractAddress, ChartsBetJson.abi, signer);
      const encodedCountry = ethers.encodeBytes32String(getCountryCode(country));

      // Call settleBet to calculate the payout
      const settleTx = await betContract.settleBet(encodedCountry);
      const receipt = await settleTx.wait();
      if (receipt.status === 0) {
        throw new Error("Settle transaction failed");
      }

      // Refresh pending payout after settling the bet
      const updatedPayout = await betContract.pendingPayouts(address);
      setPendingPayout(ethers.formatEther(updatedPayout));

      toast({
        title: "Bet settled",
        description: "Your bet has been settled and winnings calculated.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error settling bet:", error);
      let errorMessage = "An error occurred while settling the bet. Please try again.";

      const decodedError = await errorDecoder.decode(error);
      if (decodedError.reason) {
        errorMessage = `Error: ${decodedError.reason}`;
      }

      toast({
        title: "Settle error",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimPayout = async () => {
    if (!address || !walletClient) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to claim winnings.",
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

    setIsLoading(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const betContract = new ethers.Contract(betContractAddress, ChartsBetJson.abi, signer);

      const claimTx = await betContract.claimPayout();
      const receipt = await claimTx.wait();
      if (receipt.status === 0) {
        throw new Error("Claim transaction failed");
      }

      toast({
        title: "Winnings claimed",
        description: "Your winnings have been successfully claimed.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // Refresh pending payout after claim
      const updatedPayout = await betContract.pendingPayouts(address);
      setPendingPayout(ethers.formatEther(updatedPayout));
    } catch (error) {
      console.error("Error claiming payout:", error);
      let errorMessage = "An error occurred while claiming your winnings. Please try again.";

      const decodedError = await errorDecoder.decode(error);
      if (decodedError.reason) {
        errorMessage = `Error: ${decodedError.reason}`;
      }

      toast({
        title: "Claim error",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderActionButtons = () => {
    if (loadingPoolInfo) return <Text>Loading pool information...</Text>;
    if (!poolInfo) return <Text color="red.500">Failed to load pool info</Text>;

    return (
      <Box display="flex" gap="4">
        <Button
          variant="outline"
          colorScheme="blue"
          onClick={handleSettleBet}
          isLoading={isLoading}
          loadingText="Settling..."
        >
          Settle Bet
        </Button>
        <Button
          variant="outline"
          colorScheme="green"
          onClick={handleClaimPayout}
          isLoading={isLoading}
          loadingText="Claiming..."
        >
          Claim winnings ({pendingPayout} ETH)
        </Button>
      </Box>
    );
  };

  return (
    <Card
      direction={{ sm: "row" }}
      p="6"
      borderRadius="12"
      overflow="hidden"
      variant="filled"
      bg="white"
    >
      <CardBody display="flex" gap="8" p="0" alignItems="center">
        <Box display="flex" flexDirection="column" flex="1">
          <Text fontSize="xl" fontWeight="bold" mb="1">
            {artist} - {amount} ETH
          </Text>
          <Text color="gray.500">
            Placed on: {formattedDate} - {formattedTime}
          </Text>
        </Box>
        <Tooltip label="Current betting odds" aria-label="Betting odds">
          <Box
            bg="green.50"
            color="green.700"
            px="3"
            py="1"
            borderRadius="full"
            fontWeight="medium"
          >
            {odds}x
          </Box>
        </Tooltip>
      </CardBody>
      <CardFooter>{renderActionButtons()}</CardFooter>
    </Card>
  );
};

export default BetCard;

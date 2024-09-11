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
  const [loadingPoolInfo, setLoadingPoolInfo] = useState(true); // To handle poolInfo loading
  const [pendingPayout, setPendingPayout] = useState<string>("0"); // To store pending payout
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const formattedDate = new Date(date).toLocaleDateString();
  const formattedTime = new Date(date).toLocaleTimeString();

  // Fetch pool info and pending payouts
  useEffect(() => {
    const fetchPoolInfoAndPayout = async () => {
      setLoadingPoolInfo(true); // Start loading
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

        // Fetch pool info
        const info = await betContract.getPoolInfo(encodedCountry);
        setPoolInfo(info);

        // Fetch pending payout for the user
        const payout = await betContract.pendingPayouts(address);

        setPendingPayout(ethers.formatEther(payout));
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
        setLoadingPoolInfo(false); // Finish loading
      }
    };

    fetchPoolInfoAndPayout();
  }, [address, walletClient, country, toast]);

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
        throw new Error("Transaction failed");
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

  const renderActionButton = () => {
    if (loadingPoolInfo) return <Text>Loading pool information...</Text>;
    if (!poolInfo) return <Text color="red.500">Failed to load pool info</Text>;

    const betDate = new Date(date);
    const poolOpenDate = new Date(Number(poolInfo.openingTime) * 1000);
    const poolCloseDate = new Date(Number(poolInfo.scheduledClosingTime) * 1000);

    // Log pool info
    console.log(poolInfo);

    // Check if the pool open and bet date are mismatched
    if (betDate.toDateString() !== poolOpenDate.toDateString()) {
      return <Text color="red.500">Error. Contact support.</Text>;
    }

    if (!poolInfo.closed) {
      return (
        <Text>
          Claim winnings at {poolCloseDate.toLocaleTimeString()} on{" "}
          {poolCloseDate.toLocaleDateString()}
        </Text>
      );
    }

    if (pendingPayout === "0") {
      return <Text color="red.500">No pending payout to claim</Text>; // Add handling for no payouts
    }

    return (
      <Button
        my="auto"
        variant="outline"
        colorScheme="black"
        onClick={handleClaimPayout}
        isLoading={isLoading}
        loadingText="Claiming..."
      >
        Claim winnings ({pendingPayout} ETH)
      </Button>
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
      <CardFooter>{renderActionButton()}</CardFooter>
    </Card>
  );
};

export default BetCard;

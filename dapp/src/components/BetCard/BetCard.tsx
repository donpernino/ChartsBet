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
  const toast = useToast();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const formattedDate = new Date(date).toLocaleDateString();
  const formattedTime = new Date(date).toLocaleTimeString();

  useEffect(() => {
    const fetchPoolInfo = async () => {
      if (!address || !walletClient) return;

      const betContractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      if (!betContractAddress) {
        console.error("Contract address is not properly configured.");
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const betContract = new ethers.Contract(betContractAddress, ChartsBetJson.abi, provider);

        const encodedCountry = ethers.encodeBytes32String(getCountryCode(country));
        const info = await betContract.getPoolInfo(encodedCountry);

        setPoolInfo(info);
      } catch (error) {
        console.error("Error fetching pool info:", error);
      }
    };

    fetchPoolInfo();
  }, [address, walletClient, country]);

  const handleClaimWinnings = async () => {
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

      const encodedCountry = ethers.encodeBytes32String(country);

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice;

      const gasEstimate = await betContract.settleBet.estimateGas(encodedCountry);
      const gasLimit = (gasEstimate * 120n) / 100n;

      const settleTx = await betContract.settleBet(encodedCountry, {
        gasPrice,
        gasLimit,
      });

      const receipt = await settleTx.wait();
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
    } catch (error) {
      console.error("Error claiming winnings:", error);
      let errorMessage = "An error occurred while claiming your winnings. Please try again.";

      if (error instanceof Error) {
        if (error.message.includes("user rejected")) {
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
    if (!poolInfo) return null;

    const betDate = new Date(date);
    const poolOpenDate = new Date(Number(poolInfo.openingTime) * 1000);
    const poolCloseDate = new Date(Number(poolInfo.closingTime) * 1000);

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

    return (
      <Button
        my="auto"
        variant="outline"
        colorScheme="black"
        onClick={handleClaimWinnings}
        isLoading={isLoading}
        loadingText="Claiming..."
      >
        Claim winnings
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

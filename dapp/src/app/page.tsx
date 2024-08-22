import { Flex, theme } from "@chakra-ui/react";
import { ethers } from "ethers";
import { useAccount, useWalletClient } from "wagmi";

import { BetForm } from "@/components/BetForm";
import { LeaderboardList } from "@/components/LeaderboardList";

const ORACLE_ADDRESS = "0xE8D603371CA8e88FE580B5410620d5db4fcbc1b9";

export default async function Home() {
  // const { address, isConnected } = useAccount();
  // const { data: walletClient } = useWalletClient();

  return (
    <Flex flexDirection="column" minHeight="100vh" backgroundColor={theme.colors.gray[50]}>
      <LeaderboardList />
      <BetForm />
    </Flex>
  );
}

import { Flex, theme } from "@chakra-ui/react";

import { BetForm } from "@/components/BetForm";
import { LeaderboardList } from "@/components/LeaderboardList";

export default async function Home() {
  return (
    <Flex flexDirection="column" minHeight="100vh" backgroundColor={theme.colors.gray[50]}>
      <LeaderboardList />
      <BetForm />
    </Flex>
  );
}

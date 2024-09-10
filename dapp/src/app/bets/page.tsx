import { Flex, theme } from "@chakra-ui/react";

import BetsList from "@/components/BetsList/BetsList";

export default async function Home() {
  return (
    <Flex flexDirection="column" minHeight="100vh" backgroundColor={theme.colors.gray[50]}>
      <BetsList />
    </Flex>
  );
}

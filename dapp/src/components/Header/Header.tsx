"use client";
import { type FC } from "react";

import { Box, Container, Heading, theme } from "@chakra-ui/react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { useWindowSize } from "@/hooks/useWindowSize";
import Link from "next/link";

const Header: FC = () => {
  const { isTablet } = useWindowSize();

  return (
    <Box
      as="header"
      display="flex"
      position="sticky"
      flexDirection="row"
      top={0}
      zIndex={10}
      backgroundColor={theme.colors.green[100]}
    >
      <Container
        maxW="1200px"
        p="1.5rem"
        justifyContent="space-between"
        display="flex"
        flexDirection="row"
      >
        {!isTablet && (
          <Link href="/">
            <Heading as="h1" fontSize="1.5rem" className="">
              ChartsBet
            </Heading>
          </Link>
        )}
        <Box display="flex" alignItems="center" gap="8">
          <Link href="/bets">
            <Heading as="h2" fontSize="1.1rem" fontWeight="medium" textDecoration="underline">
              My bets
            </Heading>
          </Link>
          <ConnectButton />
        </Box>
      </Container>
    </Box>
  );
};

export default Header;

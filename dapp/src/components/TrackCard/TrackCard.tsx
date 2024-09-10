import React from "react";

import { LinkIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  Image,
  Link,
  Text,
  Tooltip,
} from "@chakra-ui/react";

import { useArtist } from "@/contexts/artist";
import type { Track } from "@/types/track";
import { getFormattedOdds } from "@/utils/getFormattedOdds";

type TrackCardProps = {
  track: Track;
  betDisabled?: boolean;
};

const TrackCard: React.FC<TrackCardProps> = ({ track, betDisabled = false }) => {
  const { setSelectedArtist } = useArtist();

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
        <Image
          boxSize="96px"
          objectFit="cover"
          src={track.image}
          alt={`${track.artist} - ${track.name}`}
        />
        <Text
          fontSize="xl"
          fontWeight="bold"
          rounded="full"
          bg="gray.100"
          h="10"
          w="10"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {track.rank}
        </Text>
        <Box display="flex" flexDirection="column" flex="1">
          <Text fontSize="xl" fontWeight="bold" mb="1">
            {track.artist}
          </Text>
          <Link href={track.url} isExternal display="flex" alignItems="center" gap="2">
            <Text color="gray.500">{track.name}</Text>
            <LinkIcon w={3} h={3} color="gray.500" />
          </Link>
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
            {getFormattedOdds(track.odds)}x
          </Box>
        </Tooltip>
      </CardBody>
      <CardFooter>
        <Button
          my="auto"
          variant="outline"
          colorScheme="black"
          isDisabled={betDisabled}
          onClick={() =>
            setSelectedArtist({
              artist: track.artist,
              odds: track.odds,
            })
          }
        >
          {betDisabled ? "Already betted today" : `Bet on ${track.artist}`}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TrackCard;

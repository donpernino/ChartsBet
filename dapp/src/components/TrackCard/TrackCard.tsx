"use client";

import { type FC } from "react";

import { LinkIcon } from "@chakra-ui/icons";
import { Box, Button, Card, CardBody, CardFooter, Image, Link, Text } from "@chakra-ui/react";

import { useArtist } from "@/contexts/artist";
import type { Track } from "@/types/track";

type TrackCardProps = {
  track: Track;
};

const TrackCard: FC<TrackCardProps> = ({ track }) => {
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
        <Image boxSize="96px" objectFit="cover" src={track.image} alt="Caffe Latte" />
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
        <Box display="flex" flexDirection="column">
          <Text fontSize="xl" fontWeight="bold" mb="1">
            {track.artist}
          </Text>
          <Link href={track.url} isExternal display="flex" alignItems="center" gap="2">
            <Text color="gray.500">{track.name}</Text>
            <LinkIcon w={3} h={3} color="gray.500" />
          </Link>
        </Box>
      </CardBody>
      <CardFooter>
        <Button
          variant="outline"
          colorScheme="black"
          onClick={() => setSelectedArtist(track.artist)}
        >
          Bet on {track.artist}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TrackCard;

import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import { Country, playlistIds } from './constants/playlists';
import { countryMap } from './utils/country-map';

dotenv.config();

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

const app = express();
app.use(bodyParser.json());
app.use(cors());

interface Track {
	rank: number;
	artist: string;
	name: string;
	url: string;
	image: string;
	odds: number;
}

type Leaderboards = {
	[key in Country]?: Track[];
};

let leaderboard: Leaderboards = {};

const getSpotifyToken = async (): Promise<string> => {
	const tokenResponse = await axios.post(
		'https://accounts.spotify.com/api/token',
		'grant_type=client_credentials',
		{
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Basic ${Buffer.from(
					`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
				).toString('base64')}`,
			},
		}
	);

	return tokenResponse.data.access_token;
};

function calculateOdds(rank: number, appearances: number): number {
	const effectiveRank = (rank + (rank + appearances - 1)) / 2;
	return 120 + (effectiveRank - 1) * 20;
}

const fetchLeaderboard = async (country: Country) => {
	try {
		const accessToken = await getSpotifyToken();
		const playlistId = playlistIds[country];

		if (!playlistId) {
			throw new Error(`No playlist found for country: ${country}`);
		}

		const response = await axios.get(
			`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=10`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const tracks = response.data.items;
		const artistAppearances: { [key: string]: number } = {};

		// Count artist appearances
		tracks.forEach((item: any) => {
			const artist = item.track.artists[0].name;
			artistAppearances[artist] = (artistAppearances[artist] || 0) + 1;
		});

		leaderboard[country] = tracks.map((item: any, index: number) => {
			const rank = index + 1;
			const artist = item.track.artists[0].name;
			const odds = calculateOdds(rank, artistAppearances[artist]);

			return {
				rank,
				artist,
				name: item.track.name,
				url: item.track.external_urls.spotify,
				image: item.track.album.images[0].url,
				odds,
			};
		});
	} catch (error) {
		console.error(`Error fetching leaderboard for ${country}:`, error);
	}
};

app.post(
	'/update-leaderboard/:country',
	async (req: Request, res: Response) => {
		const country = req.params.country.toUpperCase() as Country;
		if (!playlistIds[country]) {
			return res
				.status(400)
				.json({ error: `Invalid country code: ${country}` });
		}
		await fetchLeaderboard(country);
		res.json({ message: `Leaderboard updated for ${country}` });
	}
);

app.get('/daily-winner/:country', (req: Request, res: Response) => {
	const country = req.params.country.toUpperCase() as Country;

	if (!leaderboard[country]) {
		return res
			.status(404)
			.json({ error: `Leaderboard not available for ${country}` });
	}

	const winner = leaderboard[country]?.[0].artist.toLowerCase();
	res.json(winner);
});

app.get('/leaderboard/:country', (req: Request, res: Response) => {
	const country = req.params.country.toUpperCase() as Country;

	if (!leaderboard[country]) {
		return res
			.status(404)
			.json({ error: `Leaderboard not available for ${country}` });
	}

	const compact = req.query.compact === 'true';

	if (compact) {
		const compactLeaderboard = leaderboard[country]?.map((track) => ({
			artist: track.artist,
			odds: track.odds,
		}));
		res.json(compactLeaderboard);
	} else {
		res.json({
			message: `Daily Top Songs ${countryMap(country)}`,
			leaderboard: leaderboard[country],
		});
	}
});

setInterval(() => {
	Object.keys(playlistIds).forEach((country) =>
		fetchLeaderboard(country as Country)
	);
}, 24 * 60 * 60 * 1000); // Fetch daily

app.listen(8080, () => {
	console.log('Server is up and listening on port 8080');

	Object.keys(playlistIds).forEach((country) =>
		fetchLeaderboard(country as Country)
	);
});

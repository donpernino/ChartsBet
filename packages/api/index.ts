import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import { Country, playlistIds } from './constants/playlists';

dotenv.config();

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

const app = express();
app.use(bodyParser.json());

interface LeaderboardEntry {
	rank: number;
	artist: {
		name: string;
		image: string;
	};
	track: {
		name: string;
		url: string;
	};
}

type Leaderboards = {
	[key in Country]?: LeaderboardEntry[];
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

const fetchLeaderboard = async (country: Country) => {
	try {
		const accessToken = await getSpotifyToken();
		const playlistId = playlistIds[country];

		if (!playlistId) {
			throw new Error(`No playlist found for country: ${country}`);
		}

		const response = await axios.get(
			`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		// console.log(response.data.items);

		leaderboard[country] = response.data.items.map(
			(item: any, index: number) => ({
				rank: index + 1,
				artist: {
					name: item.track.artists[0].name,
				},
				track: {
					name: item.track.name,
					url: item.track.href,
				},
			})
		);

		console.log(
			`Leaderboard updated for ${country}:`,
			leaderboard[country]
		);
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

	const winner = leaderboard[country]?.[0].artist.name;
	res.json(winner);
});

app.get('/leaderboard/:country', (req: Request, res: Response) => {
	const country = req.params.country.toUpperCase() as Country;

	if (!leaderboard[country]) {
		return res
			.status(404)
			.json({ error: `Leaderboard not available for ${country}` });
	}

	res.json({
		message: `Current leaderboard for ${country}`,
		leaderboard: leaderboard[country],
	});
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

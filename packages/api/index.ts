import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const {
	SPOTIFY_CLIENT_ID,
	SPOTIFY_CLIENT_SECRET,
	SPOTIFY_TOP_50_WORLD_PLAYLIST_ID,
} = process.env;

const app = express();
app.use(bodyParser.json());

let leaderboard: any[] = [];

const getSpotifyToken = async () => {
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

const fetchLeaderboard = async () => {
	try {
		const accessToken = await getSpotifyToken();

		const response = await axios.get(
			`https://api.spotify.com/v1/playlists/${SPOTIFY_TOP_50_WORLD_PLAYLIST_ID}/tracks?limit=50`,
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		leaderboard = response.data.items.map((item: any, index: number) => ({
			rank: index + 1,
			artist: item.track.artists[0].name,
			track: item.track.name,
		}));

		console.log('Leaderboard updated:', leaderboard);
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
	}
};

app.post('/update-leaderboard', async (req: Request, res: Response) => {
	await fetchLeaderboard();
	res.json({ message: 'Leaderboard updated' });
});

app.get('/daily-winner', (req: Request, res: Response) => {
	if (leaderboard.length === 0) {
		return res.status(404).json({ error: 'Leaderboard not available' });
	}

	const winner = leaderboard[0];
	res.json(winner.artist);
});

setInterval(fetchLeaderboard, 24 * 60 * 60 * 1000);

app.listen(8080, () => {
	console.log('External adapter listening on port 8080');
	fetchLeaderboard();
});

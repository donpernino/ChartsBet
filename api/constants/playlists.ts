export type Country =
	| 'WW'
	| 'BR'
	| 'DE'
	| 'ES'
	| 'FR'
	| 'IT'
	| 'PT'
	| 'US'
	| 'TEST';

export const playlistIds: { [key in Country]: string } = {
	WW: '37i9dQZEVXbMDoHDwVN2tF', // Worldwide
	BR: '37i9dQZEVXbMXbN3EUUhlg',
	DE: '37i9dQZEVXbJiZcmkrIHGU',
	ES: '37i9dQZEVXbNFJfN1Vw8d9',
	FR: '37i9dQZEVXbIPWwFssbupI',
	IT: '37i9dQZEVXbIQnj7RRhdSX',
	PT: '37i9dQZEVXbKyJS56d1pgi',
	US: '37i9dQZEVXbLRQDuF5jeBp',
	TEST: '37i9dQZEVXbMDoHDwVN2tF',
};

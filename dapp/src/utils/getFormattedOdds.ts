export const getFormattedOdds = (odds: number) => {
  return (odds / 100).toFixed(2);
};

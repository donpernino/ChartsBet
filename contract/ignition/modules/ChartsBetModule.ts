import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('ChartsBet', (m) => {
	const owner = m.getParameter('owner');
	const tokenAddress = m.getParameter('tokenAddress');

	const chartsBet = m.contract('ChartsBet', [owner, tokenAddress]);

	m.call(chartsBet, 'initialize');

	return { chartsBet };
});

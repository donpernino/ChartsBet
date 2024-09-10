import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('ChartsBet', (m) => {
	const owner = m.getParameter('owner');

	const chartsBet = m.contract('ChartsBet', [owner]);

	m.call(chartsBet, 'initialize');

	return { chartsBet };
});

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import ChartsOracleModule from './ChartsOracle';

const ChartsBetModule = buildModule('ChartsBet', (m) => {
	const { chartsOracle } = m.useModule(ChartsOracleModule);

	const chartsBet = m.contract('ChartsBet');

	const initialize = m.call(chartsBet, 'initialize', [
		m.getAccount(0),
		chartsOracle,
	]);

	// Update the ChartsOracle with the ChartsBet address
	const updateChartsBet = m.call(chartsOracle, 'setChartsBet', [chartsBet]);

	return { chartsBet, initialize, updateChartsBet };
});

export default ChartsBetModule;

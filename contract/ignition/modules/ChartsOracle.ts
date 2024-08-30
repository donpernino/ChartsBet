import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const ChartsOracleModule = buildModule('ChartsOracle', (m) => {
	const chartsOracle = m.contract('ChartsOracle');

	const initialize = m.call(chartsOracle, 'initialize', [
		m.getAccount(0),
		'0x0000000000000000000000000000000000000000',
	]);

	return { chartsOracle };
});

export default ChartsOracleModule;

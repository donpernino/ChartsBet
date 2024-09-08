import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import ChartsBetTokenModule from './ChartsBetTokenModule';
import ChartsBetModule from './ChartsBetModule';

export default buildModule('MainModule', (m) => {
	const { token } = m.useModule(ChartsBetTokenModule);
	const { chartsBet } = m.useModule(ChartsBetModule);

	return { token, chartsBet };
});

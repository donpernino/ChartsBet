import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('ChartsBetToken', (m) => {
	const initialOwner = m.getParameter('initialOwner');

	const token = m.contract('ChartsBetToken', [initialOwner]);

	return { token };
});

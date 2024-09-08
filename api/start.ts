import { spawn } from 'child_process';
import path from 'path';

function startService(scriptPath: string, name: string) {
	const service = spawn('ts-node', [scriptPath], {
		stdio: 'inherit',
		shell: true,
	});

	console.log(`${name} service started (PID: ${service.pid})`);

	service.on('close', (code) => {
		console.log(`${name} service exited with code ${code}`);
	});

	return service;
}

const apiService = startService(path.join(__dirname, 'server.ts'), 'API');
const oracleService = startService(
	path.join(__dirname, 'oracle', 'oracle.ts'),
	'Oracle'
);

process.on('SIGINT', () => {
	console.log('Stopping all services...');
	apiService.kill();
	oracleService.kill();
});

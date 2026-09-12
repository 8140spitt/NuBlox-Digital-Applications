export default async function globalSetup() {
	await import('./seed-authenticated-fixture.mjs');
	await import('./seed-golden-reference-enterprise.mjs');
	await import('./seed-procurement-commercial-fixture.mjs');
	await import('./seed-portal-collaboration-fixture.mjs');
	await import('./seed-external-person-collaboration-fixture.mjs');
}

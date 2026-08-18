export default async function globalSetup() {
	await import('./seed-authenticated-fixture.mjs');
}

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultRemoteSampleCatalogUrl = '/samples/remote-samples.json';
const defaultRegisteredHttpSampleId = 'repo-local-http';

export const projectRoot = resolve(currentDir, '../..');
export const fixtureBaseName = 'cubescope-mini-cube';
export const fixtureHdrPath = resolve(projectRoot, 'test-data/fixtures', `${fixtureBaseName}.hdr`);
export const fixtureImgPath = resolve(projectRoot, 'test-data/fixtures', `${fixtureBaseName}.img`);
export const fixtureHttpBasePath = `/fixtures/${fixtureBaseName}`;
export const fixtureHdrUrl = `${fixtureHttpBasePath}.hdr`;
export const fixtureImgUrl = `${fixtureHttpBasePath}.img`;
export const remoteSampleCatalogPath = resolve(projectRoot, 'public/samples/remote-samples.json');
export const remoteSampleCatalogUrl = process.env.CUBESCOPE_SAMPLE_CATALOG_URL ?? defaultRemoteSampleCatalogUrl;
export const registeredHttpSampleId = process.env.CUBESCOPE_REGISTERED_SAMPLE_ID ?? defaultRegisteredHttpSampleId;
export const defaultRemoteCatalogUrl = defaultRemoteSampleCatalogUrl;

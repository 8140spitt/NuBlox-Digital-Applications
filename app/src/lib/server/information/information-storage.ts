export type InformationStoredObject = {
	storageProvider: string;
	storageBucket: string;
	storageKey: string;
	originalFilename: string;
	contentType: string | null;
	sizeBytes: number;
	checksumAlgorithm: string;
	checksumValue: string;
};

export type PutInformationObject = {
	objectKey: string;
	originalFilename: string;
	contentType: string | null;
	bytes: Uint8Array;
};

export interface InformationStorageAdapter {
	put(input: PutInformationObject): Promise<InformationStoredObject>;
	createReadUrl(object: InformationStoredObject): Promise<string>;
}

export class InformationStorageNotConfiguredError extends Error {
	constructor() {
		super('Binary document storage is not configured for this NuBlox environment.');
		this.name = 'InformationStorageNotConfiguredError';
	}
}

/**
 * Package 007 deliberately stores binary payloads outside MySQL. The V1 Slice 3
 * runtime can register authoritative object metadata, but payload upload/download
 * must cross this adapter before a deployment can claim binary-storage support.
 */
export class UnconfiguredInformationStorageAdapter implements InformationStorageAdapter {
	async put(_input: PutInformationObject): Promise<InformationStoredObject> {
		throw new InformationStorageNotConfiguredError();
	}

	async createReadUrl(_object: InformationStoredObject): Promise<string> {
		throw new InformationStorageNotConfiguredError();
	}
}

import type { AdbDevice, BackendResponse, BackupStreamedResponse } from "./api/backend";
import type { UserConfig } from "./api/storage";

declare global {
	namespace serverManagerApi {
		function startBackend(): Promise<void>;
		function startADB(): Promise<void>;
	}

	namespace electronApi {
		function onLoaded(callback: () => void): void;
		function pickFolder(): Promise<string | null>;
	}

	namespace storageApi {
		function getConfig(): Promise<UserConfig>;
		function updateConfig(updates: Partial<UserConfig>): Promise<UserConfig>;
	}

	namespace backendApi {
		function connectToADB(): Promise<BackendResponse>;
		function getDevices(): Promise<BackendResponse<AdbDevice[]>>;
		function backup(onUpdate?: (update: BackupStreamedResponse) => void, sourcePath?: string): Promise<BackendResponse>;
	}
}

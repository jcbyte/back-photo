// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";
import type { AdbDevice, BackendResponse, BackupStreamedResponse } from "./api/backend";
import type { UserConfig } from "./api/storage";

contextBridge.exposeInMainWorld("serverManagerApi", {
	startBackend: (): Promise<void> => ipcRenderer.invoke("serverManager.startBackend"),
	startADB: (): Promise<void> => ipcRenderer.invoke("serverManager.startADB"),
});

contextBridge.exposeInMainWorld("electronApi", {
	onLoaded: async (callback: () => void): Promise<void> => {
		if (await ipcRenderer.invoke("electron._isAppReady")) callback();
		else ipcRenderer.once("electron._appReady", callback);
	},
	pickFolder: (): Promise<string | null> => ipcRenderer.invoke("electron.pickFolder"),
});

contextBridge.exposeInMainWorld("storageApi", {
	getConfig: (): Promise<UserConfig> => ipcRenderer.invoke("storage.getConfig"),
	updateConfig: (updates: Partial<UserConfig>): Promise<UserConfig> =>
		ipcRenderer.invoke("storage.updateConfig", updates),
});

contextBridge.exposeInMainWorld("backendApi", {
	connectToADB: (): Promise<BackendResponse> => ipcRenderer.invoke("backend.connectToADB"),
	getDevices: (): Promise<BackendResponse<AdbDevice[]>> => ipcRenderer.invoke("backend.getDevices"),
	backup: (onUpdate?: (update: BackupStreamedResponse) => void, sourcePath?: string): Promise<BackendResponse> => {
		ipcRenderer.removeAllListeners("backend.backup:update");
		if (onUpdate) {
			ipcRenderer.on("backend.backup:update", (_event, update: BackupStreamedResponse) => {
				onUpdate(update);
			});
		}
		return ipcRenderer.invoke("backend.backup", sourcePath);
	},
});

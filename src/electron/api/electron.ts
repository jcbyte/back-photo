import { dialog, ipcMain } from "electron";
import { isAppReady } from "../runtime";

ipcMain.handle("electron.pickFolder", async () => {
	const result = await dialog.showOpenDialog({
		properties: ["openDirectory"],
	});

	if (result.canceled) return null;
	return result.filePaths[0]; // Returns the selected folder path
});

ipcMain.handle("electron._isAppReady", async () => {
	return isAppReady();
});

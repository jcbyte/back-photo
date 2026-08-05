import { app, BrowserWindow } from "electron";
import squirrelStartup from "electron-squirrel-startup";
import path from "path";
import { DEV, setAppReady } from "./runtime";

// Forge's Vite plugin defines these values for development and packaged builds.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
	app.quit();
}

import "./api/backend";
import "./api/electron";
import { cleanup, startAdbServer, startPythonServer } from "./api/serverManager";
import "./api/storage";

const createWindow = async () => {
	// Create the browser window
	const mainWindow = new BrowserWindow({
		width: 1024,
		height: 700,
		minWidth: 704,
		minHeight: 644,
		icon: DEV
			? "./assets/icon.png"
			: path.join(process.resourcesPath, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		},
	});

	// Hide the menu bar
	mainWindow.setMenuBarVisibility(false);

	// Load the index.html of the app
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		await mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
	}

	if (DEV) {
		// Open DevTools
		mainWindow.webContents.openDevTools();
	}

	await startPythonServer();
	await startAdbServer();

	setAppReady();
	mainWindow.webContents.send("electron._appReady");
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Kill servers when Electron quits
let isClean = false;
app.on("before-quit", async (event) => {
	if (!isClean) {
		event.preventDefault();
		cleanup().then(() => {
			isClean = true;
			app.quit();
		});
	}
});

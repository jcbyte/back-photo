import { app } from "electron";

export const DEV = !app.isPackaged;

let appReady = false;

export function isAppReady(): boolean {
	return appReady;
}

export function setAppReady(): void {
	appReady = true;
}

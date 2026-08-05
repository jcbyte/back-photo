import { ipcMain } from "electron";
import { EventSource } from "eventsource";
import { getAdbPort, getBackendHost } from "./serverManager";
import { getUserConfig } from "./storage";

export type BackendSuccessResponse<T = void> = T extends void ? { ok: true } : { ok: true; data: T };
export type BackendErrorResponse = { ok: false; detail: string; backendError?: "backend" | "adb" | "adbInit" };
export type BackendResponse<T = void> = BackendSuccessResponse<T> | BackendErrorResponse;

export interface BackendApiError {
	detail?: string;
}

export type AdbDevice = {
	serial: string;
} & ({ authorised: true; name: string } | { authorised: false });

export interface LogEntry {
	timestamp: number;
	type: "info" | "success" | "error" | "warning";
	content: string;
}

export interface BackupStreamedResponse {
	progress?: number;
	log?: LogEntry;
}

export interface BackupError {
	status: number;
	detail: string;
}

ipcMain.handle("backend.connectToADB", async (): Promise<BackendResponse> => {
	const apiUrl = getBackendHost();
	if (!apiUrl) return { ok: false, detail: "Unknown backend host - Was the backend started?", backendError: "backend" };

	const adbPort = getAdbPort();
	if (!adbPort) return { ok: false, detail: "Unknown adb port - Was the ADB server started?", backendError: "adb" };

	try {
		const params = new URLSearchParams({ port: String(adbPort) });
		const res = await fetch(`${apiUrl}/connect?${params.toString()}`, { method: "POST" });

		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as BackendApiError; // `catch` fallback if JSON invalid
			return {
				ok: false,
				detail: data.detail ?? "Error connecting to ADB",
				...(res.status === 503 && { backendError: "adb" }),
			};
		}

		return { ok: true };
	} catch {
		return { ok: false, detail: "Unknown error connecting to ADB - Is the backend running?", backendError: "backend" };
	}
});

ipcMain.handle("backend.getDevices", async (): Promise<BackendResponse<AdbDevice[]>> => {
	const apiUrl = getBackendHost();
	if (!apiUrl) return { ok: false, detail: "Unknown backend host - Was tha backend started?", backendError: "backend" };

	type ExpectedResponse = { devices: AdbDevice[] };

	try {
		const res = await fetch(`${apiUrl}/devices`);
		const data = (await res.json().catch(() => ({}))) as ExpectedResponse | BackendApiError; // `catch` fallback if JSON invalid

		if (!res.ok) {
			return {
				ok: false,
				detail: (data as BackendApiError).detail ?? "Error fetching devices",
				...(res.status === 503 && { backendError: "adb" }),
				...(res.status === 409 && { backendError: "adbInit" }),
			};
		}

		return { ok: true, data: (data as ExpectedResponse).devices };
	} catch {
		return { ok: false, detail: "Unknown error fetching devices - Is the backend running?", backendError: "backend" };
	}
});

let backupEs: EventSource | null = null;

ipcMain.handle("backend.backup", async (event, sourcePath?: string): Promise<BackendResponse> => {
	const apiUrl = getBackendHost();
	if (!apiUrl) return { ok: false, detail: "Unknown backend host - Was tha backend started?", backendError: "backend" };

	type ExpectedResponse = { jobId: string };

	// Get backup jobId
	let data: ExpectedResponse | BackendApiError;
	try {
		const userConfig = getUserConfig();
		const res = await fetch(`${apiUrl}/backup/start`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ config: userConfig, sourcePath }),
		});
		data = (await res.json().catch(() => ({}))) as ExpectedResponse | BackendApiError; // `catch` fallback if JSON invalid

		if (!res.ok) {
			return { ok: false, detail: (data as BackendApiError).detail ?? "Error starting backup" };
		}
	} catch {
		return {
			ok: false,
			detail: "Unknown error starting the backup - Is the backend running?",
			backendError: "backend",
		};
	}

	// SSE on backup
	return new Promise((resolve) => {
		if (backupEs) backupEs.close();
		const params = new URLSearchParams({ jobId: (data as ExpectedResponse).jobId });
		const es = new EventSource(`${apiUrl}/backup?${params.toString()}`);
		backupEs = es;

		es.onmessage = (ev) => {
			try {
				const data = JSON.parse(ev.data) as BackupStreamedResponse;
				event.sender.send("backend.backup:update", data);
			} catch {
				// Malformed data received from SSE
			}
		};

		es.addEventListener("backend-error", (ev) => {
			try {
				const data = JSON.parse(ev.data) as BackupError;
				resolve({
					ok: false,
					detail: data.detail,
					...(data.status === 503 && { backendError: "adb" }),
					...(data.status === 409 && { backendError: "adbInit" }),
				});
			} catch {
				// Malformed data received from SSE
				resolve({ ok: false, detail: ev.data });
			}
			es.close();
		});

		es.addEventListener("backend-complete", () => {
			resolve({ ok: true });
			es.close();
		});

		es.onerror = () => {
			resolve({ ok: false, detail: "Unknown error trying backup - Is the backend running?", backendError: "backend" });
			es.close();
		};
	});
});

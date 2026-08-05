/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "@/index.css";
import "@fontsource-variable/inter";

import App from "@/App";
import { BackendRunningProvider } from "@/hooks/BackendRunningProvider";
import { ThemeProvider } from "@/hooks/ThemeProvider";
import { UserConfigProvider } from "@/hooks/UserConfigProvider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Cannot create React App - Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<ThemeProvider defaultTheme="dark">
			<BackendRunningProvider>
				<UserConfigProvider>
					<App />
				</UserConfigProvider>
			</BackendRunningProvider>
		</ThemeProvider>
	</StrictMode>,
);

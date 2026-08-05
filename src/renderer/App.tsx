import { AdbDevice } from "@/../electron/api/backend";
import { LogEntry } from "@/components/LogItem";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useBackendRunning } from "@/hooks/BackendRunningProvider";
import { useTheme } from "@/hooks/ThemeProvider";
import BackendNotRunning from "@/pages/BackendNotRunning";
import Home from "@/pages/Home";
import Loading from "@/pages/Loading";
import Options from "@/pages/Options";
import { HomeIcon, MoonIcon, SettingsIcon, SunIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";

type Tab = "home" | "options";
interface TabConfig {
	icon: LucideIcon;
}
const TAB_CONFIG: Record<Tab, TabConfig> = {
	home: { icon: HomeIcon },
	options: { icon: SettingsIcon },
};

export default function App() {
	const { isLoading: backendLoading, backendRunning, markBackendDown } = useBackendRunning();
	const { theme, setTheme } = useTheme();

	const [activeTab, setActiveTab] = useState<Tab>("home");

	const [isRunning, setIsRunning] = useState(false);
	const [progress, setProgress] = useState(0);
	const [logs, setLogs] = useState<LogEntry[]>([]);

	function addLog(log: Omit<LogEntry, "timestamp"> & { timestamp?: number }) {
		if (!log.timestamp) {
			log.timestamp = Date.now() / 1000;
		}
		setLogs((prev) => [log as LogEntry, ...prev]);
	}

	async function callBackup(sourcePath?: string) {
		setIsRunning(true);
		setProgress(0);

		const res = await backendApi.backup((update) => {
			if (update.progress !== undefined) setProgress(update.progress);
			if (update.log) addLog(update.log);
		}, sourcePath);

		if (!res.ok) {
			if (res.backendError) {
				markBackendDown();
			}

			addLog({ content: res.detail, type: "error" });
		} else {
			setProgress(1);
		}

		setIsRunning(false);
	}

	const [devices, setDevices] = useState<AdbDevice[]>([]);

	async function refreshDevices() {
		const res = await backendApi.getDevices();

		if (!res.ok) {
			if (res.backendError) {
				markBackendDown();
			}

			addLog({ content: res.detail, type: "error" });
			return;
		}

		setDevices(res.data);
	}

	const activePage = (() => {
		switch (activeTab) {
			case "home":
				return (
					<Home
						isRunning={isRunning}
						backup={callBackup}
						logs={logs}
						progress={progress}
						devices={devices}
						refreshDevices={refreshDevices}
					/>
				);
			case "options":
				return <Options />;
		}
	})();

	if (backendLoading) {
		return (
			<div className="w-full h-screen">
				<Loading />
			</div>
		);
	}

	return (
		<>
			<div className="min-h-screen bg-background">
				{backendRunning ? (
					<div className="flex">
						<div className="w-16 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col items-center gap-4 py-4">
							{(Object.keys(TAB_CONFIG) as Tab[]).map((tab) => {
								const Icon = TAB_CONFIG[tab].icon;
								return (
									<Button
										key={tab}
										variant={tab === activeTab ? "default" : "ghost"}
										size="icon"
										onClick={() => setActiveTab(tab)}
										className="w-10 h-10"
									>
										<Icon className="h-5 w-5" />
									</Button>
								);
							})}

							<Button
								size="icon"
								variant="outline"
								className="mt-auto w-10 h-10"
								onClick={() => setTheme(theme === "light" ? "dark" : "light")}
							>
								{theme === "light" ? <MoonIcon /> : <SunIcon />}
							</Button>
						</div>

						<div className="flex-1 h-screen overflow-y-auto">{activePage}</div>
					</div>
				) : (
					<BackendNotRunning />
				)}
			</div>

			<Toaster position="top-center" theme={theme} />
		</>
	);
}

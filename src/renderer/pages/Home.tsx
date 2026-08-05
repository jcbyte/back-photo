import { AdbDevice } from "@/../electron/api/backend";
import LogItem, { type LogEntry } from "@/components/LogItem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserConfig } from "@/hooks/UserConfigProvider";
import Loading from "@/pages/Loading";
import {
	CircleAlertIcon,
	CircleCheckIcon,
	FolderIcon,
	FolderOpen,
	LoaderCircleIcon,
	LogsIcon,
	Play,
	RefreshCw,
	SmartphoneIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function Home({
	isRunning,
	backup,
	logs,
	progress,
	devices,
	refreshDevices,
}: {
	isRunning: boolean;
	backup: (sourcePath?: string) => void;
	logs: LogEntry[];
	progress: number;
	devices: AdbDevice[];
	refreshDevices: () => Promise<void>;
}) {
	const { userConfig, updateUserConfig } = useUserConfig();

	const [refreshingDevices, setRefreshingDevices] = useState<boolean>(false);
	const [sourceType, setSourceType] = useState<"phone" | "folder">("phone");
	const [sourcePath, setSourcePath] = useState("");

	async function handleRefreshDevices() {
		if (isRunning) return;

		setRefreshingDevices(true);
		await refreshDevices();
		setRefreshingDevices(false);
	}

	async function selectDestinationFolder() {
		const folderPath = await electronApi.pickFolder();
		if (!folderPath) return;

		updateUserConfig({ destinationPath: folderPath });
	}

	async function selectSourceFolder() {
		const folderPath = await electronApi.pickFolder();
		if (!folderPath) return;

		setSourcePath(folderPath);
	}

	useEffect(() => {
		let refreshInterval: NodeJS.Timeout | null = null;
		if (!isRunning && sourceType === "phone") {
			refreshDevices();
			refreshInterval = setInterval(refreshDevices, 2000);
		}

		return () => {
			if (refreshInterval) clearInterval(refreshInterval);
		};
	}, [isRunning, sourceType]);

	if (!userConfig) {
		return <Loading />;
	}

	const selectedDeviceIsAuthorised = devices.find((device) => device.serial === userConfig.adbDevice)?.authorised;
	const sameLocalFolders = sourcePath.trim().toLowerCase() === userConfig.destinationPath.trim().toLowerCase();
	const validSource = sourceType === "phone" ? selectedDeviceIsAuthorised : sourcePath.trim() && !sameLocalFolders;

	return (
		<div className="container mx-auto p-6 flex flex-col gap-4">
			{/* Header */}
			<div className="flex flex-col">
				<h1 className="text-3xl font-bold tracking-tight">BackPhoto</h1>
				<p className="text-muted-foreground">Back up your photos, save space</p>
			</div>

			<div className="flex flex-col items-stretch gap-3">
				<div className="flex gap-3">
					{/* Source Selection & Controls */}
					<Card className="min-w-96">
						<CardHeader>
							<CardTitle>Back Up From</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col gap-4">
								<div className="flex flex-col gap-2">
									<Tabs value={sourceType} onValueChange={(value) => setSourceType(value as "phone" | "folder")}>
										<TabsList className="grid w-full grid-cols-2">
											<TabsTrigger value="phone" disabled={isRunning}>
												<SmartphoneIcon /> Phone
											</TabsTrigger>
											<TabsTrigger value="folder" disabled={isRunning}>
												<FolderIcon /> PC Folder
											</TabsTrigger>
										</TabsList>

										<TabsContent value="phone" className="flex flex-col">
											<label className="text-sm font-semibold">Device</label>
											<div className="flex gap-2">
												<Select
													value={userConfig.adbDevice}
													onValueChange={(selected) => updateUserConfig({ adbDevice: selected })}
													disabled={isRunning}
												>
													<SelectTrigger className="flex-1">
														<SelectValue placeholder={"Select device"} />
													</SelectTrigger>
													<SelectContent>
														{devices.map((device) => (
															<SelectItem key={device.serial} value={device.serial} disabled={!device.authorised}>
																<div className="flex items-center gap-2">
																	{device.authorised ? (
																		<CircleCheckIcon className="h-4 w-4 text-success" />
																	) : (
																		<CircleAlertIcon className="h-4 w-4 text-warning" />
																	)}
																	<span>{device.authorised ? device.name : device.serial}</span>
																</div>
															</SelectItem>
														))}
														{userConfig.adbDevice &&
														!devices.some((device) => device.serial === userConfig.adbDevice) ? (
															<SelectItem value={userConfig.adbDevice} disabled>
																<div className="flex items-center gap-2">
																	<CircleAlertIcon className="h-4 w-4 text-muted-foreground" />
																	<span className="text-muted-foreground">{userConfig.adbDevice}</span>
																</div>
															</SelectItem>
														) : (
															devices.length === 0 && (
																<SelectItem value="no-device" disabled>
																	<div className="flex items-center gap-2">
																		<span>No devices connected</span>
																	</div>
																</SelectItem>
															)
														)}
													</SelectContent>
												</Select>
												<Button
													variant="outline"
													size="icon"
													onClick={handleRefreshDevices}
													disabled={isRunning || refreshingDevices}
												>
													<RefreshCw className={`h-4 w-4 ${refreshingDevices && "animate-spin"}`} />
												</Button>
											</div>
										</TabsContent>

										<TabsContent value="folder" className="flex flex-col">
											<label className="text-sm font-semibold">Source Folder</label>
											<div className="flex gap-2">
												<Input
													className="flex-1"
													placeholder="D:\\Unsorted Photos"
													value={sourcePath}
													onChange={(event) => setSourcePath(event.target.value)}
													disabled={isRunning}
												/>
												<Button variant="outline" size="icon" onClick={selectSourceFolder} disabled={isRunning}>
													<FolderOpen className="h-4 w-4" />
												</Button>
											</div>
											{sameLocalFolders && sourcePath.trim() && (
												<span className="text-sm text-destructive">Source and destination must be different.</span>
											)}
										</TabsContent>
									</Tabs>

									<div className="flex flex-col">
										<label className="text-sm font-semibold">Destination Path</label>
										<div className="flex gap-2">
											<Input
												className="flex-1"
												placeholder="D:\Photos\Phone"
												value={userConfig.destinationPath}
												onChange={(e) => updateUserConfig({ destinationPath: e.target.value })}
												disabled={isRunning}
											/>
											<Button variant="outline" size="icon" onClick={selectDestinationFolder} disabled={isRunning}>
												<FolderOpen className="h-4 w-4" />
											</Button>
										</div>
									</div>
								</div>

								<Button
									disabled={!validSource || !userConfig.destinationPath.trim() || isRunning}
									className="w-full"
									size="lg"
									onClick={() => backup(sourceType === "folder" ? sourcePath : undefined)}
								>
									{isRunning ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
									Back Up
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Progress */}
					<Card className="flex-1">
						<CardHeader>
							<CardTitle>Back Up Progress</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex flex-col gap-2">
								<div className="flex justify-between">
									<span className="text-sm">Progress</span>
									<span className="text-sm">{Math.floor(progress * 100)}%</span>
								</div>
								<Progress value={progress * 100} className="h-2" />
								<p className="text-sm text-muted-foreground">{isRunning ? "In progress..." : "Ready to start"}</p>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Logs */}
				<div className="flex-1">
					<Card>
						<CardHeader>
							<CardTitle>Activity Log</CardTitle>
						</CardHeader>
						<CardContent>
							<ScrollArea className="min-h-40 max-h-[calc(100vh-30rem)] px-1.5 overflow-auto">
								<div className="flex flex-col gap-2">
									{logs.map((log, i) => (
										<LogItem key={`log-${i}`} log={log} />
									))}
									{logs.length === 0 && (
										<div className="flex flex-col gap-1 justify-center items-center pt-6">
											<div className="w-14 h-14 bg-muted rounded-lg flex justify-center items-center">
												<LogsIcon className="w-8 h-8" />
											</div>
											<span className="text-sm text-muted-foreground">No Logs Yet</span>
										</div>
									)}
								</div>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

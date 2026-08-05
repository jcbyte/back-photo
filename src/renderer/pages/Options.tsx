import DescriptiveSwitch from "@/components/DescriptiveSwitch";
import MultipleValueInputCard from "@/components/MultipleValueInputCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserConfig } from "@/hooks/UserConfigProvider";
import { AlertTriangleIcon, FolderIcon } from "lucide-react";
import { toast } from "sonner";
import Loading from "./Loading";

export default function Options() {
	const { userConfig, updateUserConfig } = useUserConfig();

	function toPosix(path: string): string {
		let p = path.trim();
		if (!p) return "/";
		p = p.replace(/\\/g, "/"); // replace backslashes with forward slashes
		p = p.replace(/\/+/g, "/"); // remove duplicate slashes
		if (!p.startsWith("/")) p = "/" + p; // ensure leading slash
		if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1); // remove trailing slash (unless root "/")

		return p;
	}

	function handleAddIgnoredDir(newDirectory: string): boolean {
		const normalisedDir = toPosix(newDirectory);

		if (!userConfig || userConfig.ignoredDirs.includes(normalisedDir)) {
			toast.warning("That directory already exists!");
			return false;
		}

		updateUserConfig({ ignoredDirs: [...userConfig.ignoredDirs, normalisedDir] });
		return true;
	}

	function handleRemoveIgnoredDir(dir: string) {
		if (!userConfig) return;

		updateUserConfig({ ignoredDirs: userConfig.ignoredDirs.filter((d) => d !== dir) });
	}

	function toExt(ext: string): string {
		let e = ext.trim().toLowerCase();
		if (!e.startsWith(".")) e = "." + e; // ensure leading dot
		return e;
	}

	function handleAddFileType(fileType: string): boolean {
		const normalisedFileType = toExt(fileType);
		if (!userConfig || userConfig.fileTypes.includes(normalisedFileType)) {
			toast.warning("That file type already exists!");
			return false;
		}

		updateUserConfig({ fileTypes: [...userConfig.fileTypes, normalisedFileType] });
		return true;
	}

	function handleRemoveFileType(fileType: string) {
		if (!userConfig) return;

		updateUserConfig({ fileTypes: userConfig.fileTypes.filter((ft) => ft !== fileType) });
	}

	if (!userConfig) {
		return <Loading />;
	}

	return (
		<div className="container mx-auto p-6 flex flex-col gap-4">
			{/* Header */}
			<div className="flex flex-col">
				<h1 className="text-3xl font-bold tracking-tight">Settings</h1>
				<p className="text-muted-foreground">Configure your preferences</p>
			</div>

			{/* Ignored Directories */}
			<MultipleValueInputCard
				title="Ignored Directories"
				subtitle="These directories will be excluded from scanning"
				placeholder="Enter directory name (e.g., /sdcard/DCIM/Ollie)"
				currentlyText="Currently Ignored"
				Icon={FolderIcon}
				values={userConfig.ignoredDirs}
				onAddValue={handleAddIgnoredDir}
				onRemoveValue={handleRemoveIgnoredDir}
			/>

			{/* Included File Types */}
			<MultipleValueInputCard
				title="Included File Types"
				subtitle="These file types will be backed up"
				placeholder="Enter file extension (e.g., .jpg, .mp4)"
				currentlyText="Currently Included"
				Icon={FolderIcon}
				values={userConfig.fileTypes}
				onAddValue={handleAddFileType}
				onRemoveValue={handleRemoveFileType}
			/>

			{/* Boolean Toggles */}
			<div className="col-span-4">
				<Card className="h-full">
					<CardHeader>
						<CardTitle>General Settings</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-2">
							<DescriptiveSwitch
								checked={userConfig.setExif}
								onChange={(value) => updateUserConfig({ setExif: value })}
								title="Set Missing EXIF Timestamps"
								description="Automatically add timestamps to photos without EXIF data (existing timestamps remain unchanged)."
							/>

							<DescriptiveSwitch
								checked={userConfig.skipDot}
								onChange={(value) => updateUserConfig({ skipDot: value })}
								title="Skip Hidden Files"
								description="Ignore files and folders starting with a dot (.)."
							/>

							<DescriptiveSwitch
								checked={userConfig.moveFiles}
								onChange={(value) => updateUserConfig({ moveFiles: value })}
								title="Move Files Instead of Copying"
								description="Remove files from the device after backup."
							/>

							{!userConfig.moveFiles && (
								<Alert variant="destructive">
									<AlertTriangleIcon className="h-4 w-4" />
									<AlertDescription>
										<span>
											<span className="font-semibold">Warning:</span> Copying files may create duplicates in destination
											folder when re-run.
										</span>
									</AlertDescription>
								</Alert>
							)}

							<DescriptiveSwitch
								checked={userConfig.removeTempFiles}
								onChange={(value) => updateUserConfig({ removeTempFiles: value })}
								title="Remove Temporary Files"
								description="Remove BackPhoto's temporary files after backup is complete."
							/>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
	packagerConfig: {
		asar: true,
		extraResource: ["./dist", "./assets"],
		icon: "./assets/icon",
	},
	rebuildConfig: {},
	makers: [
		new MakerSquirrel({
			setupIcon: "./assets/icon.ico",
			iconUrl: "https://raw.githubusercontent.com/jcbyte/back-photo/refs/heads/main/assets/icon.ico",
		}),
		new MakerZIP({}, ["darwin"]), // ! Untested on macos
		new MakerDeb({
			options: {
				icon: "./assets/icon.png",
			},
		}),
	],
	plugins: [
		new AutoUnpackNativesPlugin({}),
		new VitePlugin({
			build: [
				{ entry: "src/electron/main.ts", config: "vite.main.config.ts" },
				{ entry: "src/electron/preload.ts", config: "vite.preload.config.ts" },
			],
			renderer: [{ name: "main_window", config: "vite.renderer.config.mts" }],
		}),
		// Fuses are used to enable/disable various Electron functionality
		// at package time, before code signing the application
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
	publishers: [
		{
			name: "@electron-forge/publisher-github",
			config: {
				repository: {
					owner: "jcbyte",
					name: "back-photo",
				},
				draft: false,
				prerelease: false,
			},
		},
	],
};

export default config;

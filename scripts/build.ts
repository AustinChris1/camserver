import { $ } from "bun";

const buildConfig = {
	version: 3,
	routes: [
		{
			src: "/.*",
			dest: "/",
		},
	],
};

const functionConfig = {
	runtime: "nodejs20.x",
	handler: "index.mjs",
};

const buildDir = "./.vercel/output";
const functionDirectory = `${buildDir}/functions/index.func`;

await Bun.build({
	entrypoints: ["./scripts/run.ts"],
	outdir: "./build",
	target: "node",
}).then(console.log);

await $`rm -rf ${buildDir}`;

await Bun.write(`${buildDir}/config.json`, JSON.stringify(buildConfig));

await $`mkdir -p ${functionDirectory}`;

await Bun.write(
	`${functionDirectory}/.vc-config.json`,
	JSON.stringify(functionConfig),
);

await $`cp ./build/* ${functionDirectory}`;
await $`mv ./build/run.js index.mjs`;

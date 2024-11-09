import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */

	experimental: {
		turbo: {
			rules: {
				"*.html": ["raw-loader"],
			},
		},
	},
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */

	experimental: {
		turbo: {
			rules: {
				// "*.html": ["raw-loader"],
				// ".html": ["raw-loader"],
				// "*.html": ["svg-inline-loader"],
				// ".html": ["svg-inline-loader"],
				// "*.html": ["file-loader"],
				// ".html": ["file-loader"],
				// "*.html": ["html-loader"],
				// ".html": ["html-loader"],
				"*.html": ["@svgr/webpack"],
				// ".html": ["@svgr/webpack"],
			},
		},
	},
};

export default nextConfig;

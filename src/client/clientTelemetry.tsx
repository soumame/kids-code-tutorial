import { useEffect } from "react";
import * as Sentry from "@sentry/react";
import {
	createRoutesFromChildren,
	matchRoutes,
	useLocation,
	useNavigationType,
} from "react-router-dom";
import type { AppConfig } from "../type.js";

const FrontendTracer = async () => {
	async function fetchConfig(): Promise<AppConfig> {
		try {
			const response = await fetch("/api/admin/config/");
			const data = (await response.json()) as AppConfig;
			return data;
		} catch (error) {
			console.error("Failed to fetch config:", error);
		}
		return {} as AppConfig;
	}

	const config = await fetchConfig();

	const sentryDsn = config.General_Settings.Sentry_DSN;

	if (sentryDsn !== "" && sentryDsn !== undefined) {
		console.log("sentry is enabled");
		Sentry.init({
			dsn: sentryDsn,
			tracesSampleRate: 1.0,
			integrations: [
				Sentry.reactRouterV6BrowserTracingIntegration({
					useEffect,
					useLocation,
					useNavigationType,
					createRoutesFromChildren,
					matchRoutes,
				}),
				Sentry.replayIntegration(),
			],
		});
	} else {
		console.log("sentry is disabled");
	}
};

export default FrontendTracer;

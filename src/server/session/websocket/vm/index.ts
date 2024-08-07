import { Worker } from "node:worker_threads";
import { exec } from "node:child_process";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
//import nodeHttpProxy from "http-proxy";
//import proxy from "express-http-proxy";
import { WebSocketServer, type WebSocket } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionValue, Dialogue, ContentType } from "../../../../type.js";
import { sessionDB } from "../../../db/session.js";
import type { vmMessage } from "./tsWorker.js";
import LogBuffer from "./logBuffer.js";
import cors from "cors";
import { request } from "node:http";
import { vmApp } from "../../../main.js";
import { getConfig } from "../../../getConfig.js";
import updateDatabase from "../updateDB.js";
import i18next from "i18next";
import I18NexFsBackend, { type FsBackendOptions } from "i18next-fs-backend";

//debug
console.log("vm/index.js: Loading vm app");

//configを読み込む
const config = getConfig();

//i18nの設定
// i18n configuration
i18next.use(I18NexFsBackend).init<FsBackendOptions>(
	{
		backend: {
			loadPath: "src/i18n/{{lng}}.json",
		},
		fallbackLng: "en",
		preload: ["ja", "en", "zh", "ms"], // Add the languages you want to preload
	},
	(err, t) => {
		if (err) return console.error(err);
		console.log("i18next initialized");
	},
);
const { t } = i18next;

// `__dirname` を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VMのインスタンスを管理するインターフェース
// VMのインスタンスを管理するインターフェースにWorkerを追加
interface VMInstance {
	running: boolean;
	worker: Worker;
}

// VMのインスタンスを管理するオブジェクト
const vmInstances: { [key: string]: VMInstance } = {};

const vmExpress = vmApp;

// 修正されたExecCodeTest関数
export async function ExecCodeTest(
	code: string,
	uuid: string,
	userScript: string,
	serverRootPath: string,
	clients: Map<string, any>,
	DBupdator: (
		code: string,
		newData: SessionValue,
		clients: Map<string, any>,
	) => Promise<void>,
): Promise<string> {
	const session = await sessionDB.get(code);
	if (!session) {
		return "Invalid session";
	}
	const sessionValue: SessionValue = JSON.parse(session);
	if (sessionValue.uuid !== uuid) {
		return "Invalid uuid";
	}

	const logBuffer = new LogBuffer(
		async (code, logs) => {
			const session = await sessionDB.get(code);
			if (!session) {
				return;
			}
			const sessionValue: SessionValue = JSON.parse(session);
			sessionValue.dialogue.push(logs);
			await DBupdator(code, sessionValue, clients);
		},
		code,
		async () => {
			const session = await sessionDB.get(code);
			return session ? JSON.parse(session) : null;
		},
	);

	try {
		const worker = new Worker(path.resolve(__dirname, "./worker.mjs"), {
			workerData: { code, uuid, serverRootPath, userScript },
			resourceLimits: {
				codeRangeSizeMb: config.Code_Execution_Limits.Max_CodeRangeSizeMb,
				maxOldGenerationSizeMb:
					config.Code_Execution_Limits.Max_OldGenerationSizeMb,
				maxYoungGenerationSizeMb:
					config.Code_Execution_Limits.Max_YoungGenerationSizeMb,
			},
		});

		worker.on("message", (msg: vmMessage) => {
			if (msg.type === "log") logBuffer.add(msg.content);
			if (msg.type === "error") logBuffer.error(msg.content);

			if (msg.type === "openVM") {
				console.log("VM server received on port", msg.port);

				const port = msg.port;
				const ip = msg.ip;
				if (!port) {
					return;
				}

				const proxy = createProxyMiddleware({
					target: `http://${ip}:${port}`,
					changeOrigin: true,
					ws: true,
					logger: console,
					on: {
						error: (err, req, res) => {
							console.log("error on proxy", err);
						},
						proxyReqWs: (proxyReq, req, socket, options, head) => {
							console.log("proxyReqWs");
						},
						proxyReq: (proxyReq, req, res) => {
							console.log("proxyReq");
						},
					},
				});

				// HTTPとWebSocketの両方のプロキシを設定
				vmExpress.use((req, res, next) => {
					if (req.originalUrl.includes(`/${code}`)) {
						proxy(req, res, next);
					} else {
						next();
					}
				});
			}
		});

		worker.on("error", (err) => {
			if (err.toString().includes("ERR_WORKER_OUT_OF_MEMORY")) {
				logBuffer.error(
					`${t("error.error")}: ${t("vm.outOfMemory")} (${err.message})`,
				);
			} else {
				logBuffer.error(`${t("error.error")}: ${err.message}`);
			}
			console.log("Worker error:", err);
		});

		worker.on("exit", (exitcode) => {
			console.log(`Worker stopped with exit code ${exitcode}`);
			logBuffer.stop();
			StopCodeTest(code, uuid, clients, DBupdator);
		});

		// workerインスタンスを保存
		vmInstances[uuid] = { running: true, worker: worker };
	} catch (e) {
		console.log("error on VM execution");
		console.log(e);
		await StopCodeTest(code, uuid, clients, DBupdator);
	}

	logBuffer.start();

	return "Valid uuid";
}

// 修正されたStopCodeTest関数
export async function StopCodeTest(
	code: string,
	uuid: string,
	clients: Map<string, any>,
	DBupdator: (
		code: string,
		newData: SessionValue,
		clients: Map<string, any>,
	) => Promise<void>,
): Promise<{ message: string; error: string }> {
	const instance = vmInstances[uuid];
	if (instance?.running) {
		instance.running = false;
		const session = await sessionDB.get(code);
		if (!session) {
			return {
				message: "Invalid session",
				error: "Invalid session",
			};
		}
		if (JSON.parse(session).uuid !== uuid) {
			return {
				message: "Invalid uuid",
				error: "Invalid uuid",
			};
		}
		console.log("updating session result");

		// Workerを終了
		await instance.worker.terminate();

		delete vmInstances[uuid];

		const stack = vmExpress._router.stack;
		for (let i = stack.length - 1; i >= 0; i--) {
			const layer = stack[i];
			if (layer.route?.path?.toString().includes(code)) {
				stack.splice(i, 1);
			}
		}
		//DBを更新し、クライアントに通知
		const sessionValue: SessionValue = JSON.parse(session);
		sessionValue.isVMRunning = false;
		await DBupdator(code, sessionValue, clients);
		return {
			message: "Script execution stopped successfully.",
			error: "",
		};
	}
	return {
		message: "Script is not running.",
		error: "Script is not running.",
	};
}

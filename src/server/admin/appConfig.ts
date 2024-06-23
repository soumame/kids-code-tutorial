import * as fs from "node:fs";
import * as path from "node:path";
import express from "express";
import type { AppConfig } from "../../type.js";

const appConfiguration = express.Router();
const configPath = path.resolve("dist/appConfig.json");
const defaultConfigPath = path.resolve("src/server/admin/defaultAppConfig.json");

// JSONボディパーサーを追加
appConfiguration.use(express.json());

//設定ファイルを更新するか、作成する
appConfiguration.post("/update", (req, res) => {
  try {
    if (fs.existsSync(configPath)) {
      const newConfig: AppConfig = req.body;
      if (!newConfig) {
        throw new Error("Invalid configuration data");
      }
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      console.info("Config updated");
      res.send("Config updated");
    } else {
      fs.copyFileSync(defaultConfigPath, configPath);
      console.info("Config file created");
      res.send("Config file created");
    }
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).send("Failed to update config");
  }
});

//設定ファイルを取得
appConfiguration.get("/", (_req, res) => {
  try {
    if (fs.existsSync(configPath)) {
      const currentConfig = fs.readFileSync(configPath, "utf-8");
      console.info("Config sent");
      res.send(currentConfig);
    } else {
      fs.copyFileSync(defaultConfigPath, configPath);
      console.info("Config file created");
      res.send("Config file created");
    }
  } catch (error) {
    console.error("Error fetching config:", error);
    res.status(500).send("Failed to fetch config");
  }
});

export default appConfiguration;
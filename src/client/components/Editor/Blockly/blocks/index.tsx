import * as Blockly from "blockly";

// src/extensions/*/blocks/以下からすべてのツールボックスを動的にインポート
const extensionModules: any = import.meta.glob(
	"/src/extensions/*/blocks/**/*.*",
	{
		eager: true,
	},
);

// 拡張機能モジュールを読み込む関数
const loadExtensions = () => {
	const extensions = Object.values(extensionModules);
	return extensions.map((mod: any) => mod);
};

const loadedExtensions = loadExtensions();
console.log("loadedExtensions for block", loadedExtensions);

function registerBlocks(language: string) {
	console.log("registerBlocks");

	loadedExtensions.forEach((module: any) => {
		if (module && typeof module === "object") {
			const { block, code, locale } = module;
			console.log("registerBlocks", block);

			if (block) {
				Blockly.Blocks[block.type] = {
					init: function () {
						this.jsonInit(block);
					},
				};

				if (code) {
					// codeを登録する関数がある場合は実行する
					code();
				}

				if (locale?.[language]) {
					// localeが記述されている場合は登録する(json形式)
					console.log("register locale", locale);
					console.log("register language", language);
					for (const key in locale[language]) {
						if (locale[language].hasOwnProperty(key)) {
							Blockly.Msg[key] = locale[language][key];
						}
					}
				}
			}
		} else {
			console.warn("Module is not an object or is undefined", module);
		}
	});
}

export default registerBlocks;

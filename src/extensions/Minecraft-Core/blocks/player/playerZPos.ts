import { Order, javascriptGenerator } from "blockly/javascript";

export const block = {
	type: "ext_minecraft_var_PlayerZPos",
	colour: "#a855f7",
	message0: "%{BKY_MINECRAFT_VAR_PLAYERZPOS}",
	output: "Number",
};

export function code() {
	javascriptGenerator.forBlock.ext_minecraft_var_PlayerZPos = (
		block,
		generator,
	) => {
		return ["minecraftWorldState.player.position.z", Order.ATOMIC];
	};
}

export const locale = {
	en: {
		MINECRAFT_VAR_PLAYERZPOS: "Player Z position",
	},
	ja: {
		MINECRAFT_VAR_PLAYERZPOS: "プレイヤーのZ座標",
	},
};

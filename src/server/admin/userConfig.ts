import express from "express";
import { generateIdFromEntropySize } from "lucia";
import { saltAndHashPassword } from "../../utils/password.js";
// 既存のDBに接続する
import { db } from "../db/index.js";
import { eq } from "drizzle-orm";
import { authSessions, users } from "../db/schema.js";

const usersConfiguration = express.Router();

// JSONボディパーサーを追加
usersConfiguration.use(express.json());

// ユーザーの一覧を取得するAPI
usersConfiguration.get("/", async (req, res) => {
	try {
		//const users = userDB.prepare("SELECT * FROM users").all();
		const getUsers = await db.select().from(users);
		res.json(getUsers);
	} catch (err) {
		res.status(500).json({ error: (err as Error).message });
	}
});

usersConfiguration.post("/new", async (req, res) => {
	console.log("create user");
	const { username, password } = req.body;
	console.log(`username: ${username}`);
	console.log(`password: ${password}`);
	try {
		const hashedPassword = await saltAndHashPassword(password);

		const insert = await db
			.insert(users)
			.values({
				username: username,
				password: hashedPassword,
			})
			.returning({
				username: users.username,
				id: users.id,
			});
		res.json(insert);
	} catch (err) {
		console.log(`Failed to create user${err}`);
		res.status(500).json({ error: (err as Error).message });
	}
});

// ユーザーの情報を取得するAPI
usersConfiguration.get("/:id", async (req, res) => {
	const id = Number(req.params.id);
	try {
		if (typeof id !== "string") {
			res.status(400).json({ error: "ID is required" });
			return;
		}
		const user = await db.query.users.findFirst({
			where: eq(users.id, id),
		});
		if (user) {
			const { password, ...userWithoutPassword } = user;
			res.json(userWithoutPassword);
		} else {
			res.status(404).json({ error: "User not found" });
		}
	} catch (err) {
		res.status(500).json({ error: (err as Error).message });
	}
});

// ユーザーの情報を更新するAPI
usersConfiguration.put("/:id", async (req, res) => {
	console.log("update user");
	const id = Number(req.params.id);
	const { password, username } = req.body; // ここで必要なフィールドを指定

	try {
		//まずは関連するセッションを削除
		// まず関連するセッションを削除する
		await db.delete(authSessions).where(eq(authSessions.userId, id));
		if (password) {
			// パスワードが空でない場合はハッシュ化して更新
			const hashedPassword = await saltAndHashPassword(password);
			const result = await db

				.update(users)
				.set({
					username: username,
					password: hashedPassword,
				})
				.where(eq(users.id, id))
				.returning({
					id: users.id,
				});
			if (result !== undefined) {
				res.json({ message: "User updated successfully" });
			} else {
				res.status(404).json({ error: "User not found" });
			}
		} else {
			const result = await db
				.update(users)
				.set({
					username: username,
				})
				.where(eq(users.id, id))
				.returning({
					id: users.id,
				});
			if (result !== undefined) {
				res.json({ message: "User updated successfully" });
			} else {
				res.status(404).json({ error: "User not found" });
			}
		}
	} catch (err) {
		res.status(500).json({ error: (err as Error).message });
	}
});

// ユーザーを削除するAPI
usersConfiguration.delete("/:id", async (req, res) => {
	console.log("delete user");
	const id = Number(req.params.id);
	try {
		// まず関連するセッションを削除する
		const deleteSessions = await db
			.delete(authSessions)
			.where(eq(authSessions.userId, id))
			.returning({
				id: authSessions.id,
			});

		// 次にユーザーを削除する
		const result = await db.delete(users).where(eq(users.id, id)).returning({
			id: users.id,
		});

		if (result.length > 0) {
			res.json({
				message: "User and associated sessions deleted successfully",
				deletedSessions: deleteSessions,
			});
		} else {
			res.status(404).json({ error: "User not found" });
		}
	} catch (err) {
		console.log(`Failed to delete user and sessions: ${err}`);
		res.status(500).json({ error: (err as Error).message });
	}
});

export default usersConfiguration;

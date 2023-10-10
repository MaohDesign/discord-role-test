import { NextApiRequest, NextApiResponse } from "next";
import fetch from "node-fetch";

const url =
  process.env.NEXT_PUBLIC_PHASE === "local"
    ? "http://localhost:3000/"
    : "https://discord-role-test.vercel.app/";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const code = req.query.code as string | undefined;

  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  try {
    // アクセストークンの取得
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: url + "api/auth/callback",
        scope: "identify",
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const tokenData = (await tokenResponse.json()) as {
      error?: string;
      error_description?: string;
      access_token?: string;
    };

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description });
    }

    const accessToken = tokenData.access_token;

    // アクセストークンを使用してユーザーのDiscord情報を取得
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userData = (await userResponse.json()) as { id: string };
    const discordUserId = userData.id;

    console.log("userData", userData);

    // ロールの付与
    const guildId = process.env.DISCORD_SERVER_ID!;
    const roleId = process.env.DISCORD_ROLE_ID!;

    const memberResponse = await fetch(
      `https://discord.com/api/guilds/${guildId}/members/${discordUserId}`,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN!}`,
        },
      }
    );
    const memberData = (await memberResponse.json()) as any;

    // ユーザーがサーバーに参加しているかどうかを確認
    if (memberData.message === "Unknown Member") {
      // ユーザーはサーバーに参加していない
      res.writeHead(302, { Location: "/?status=unknown-member" });
      res.end();
    }

    // ユーザーがすでにロールを持っているかどうかを確認
    if (
      memberData.roles &&
      memberData.roles.includes(process.env.DISCORD_ROLE_ID!)
    ) {
      // ユーザーはすでにロールを持っている
      res.writeHead(302, { Location: "/?status=hadRole" });
      res.end();
    }

    await fetch(
      `https://discord.com/api/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN!}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.writeHead(302, { Location: "/?status=success" });
    res.end();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

import { accessTokenUserSchema, ContextUser } from "../types/user";
import { randomUUID } from "crypto";
import jwt, { Algorithm, Secret, SignOptions } from 'jsonwebtoken'
import { RefreshModel } from "./refreshModel";
import { Context } from "koa";
import mongoose from "mongoose";

const REFRESH_EXPIRE_SEC = 18 * 24 * 60 * 60;


export function signAccessToken(user: ContextUser) {
  return jwt.sign(
    {
      _id: user._id, 
      username: user.username, 
      roles: user.roles, 
      liked_subject: user.liked_subject,
      pfp_url: user.pfp_url, 
      recent_viewed: user.recent_viewed,
    },
    (process.env.JWT_SECRET as Secret),
    {
      algorithm: (process.env.JWT_ALGORITHM as Algorithm),
      subject: user._id.toString(),
      expiresIn: 900,
      issuer: "sshs-ocw"
    } satisfies SignOptions
  )
}

export async function mintRefreshToken(userId: string | mongoose.Types.ObjectId) {
  const jti = randomUUID();
  const expSec = Math.floor(Date.now() / 1000) + REFRESH_EXPIRE_SEC;

  const refreshToken = jwt.sign(
    {
      sub: userId,
      jti: jti,
    },
    process.env.REFRESH_JWT_SECRET as Secret,
    {
      algorithm: process.env.JWT_ALGORITHM as Algorithm,
      expiresIn: REFRESH_EXPIRE_SEC,
      issuer: "sshs-ocw"
    }
  )

  await RefreshModel.create({
    jti: jti,
    userId: userId,
    token: refreshToken,
    expiresAt: new Date(expSec * 1000)
  })

  return {
    token: refreshToken,
    jti: jti,
  }
}

export function setRefreshCookie(ctx: Context, refreshToken: string, maxAgeMs = REFRESH_EXPIRE_SEC * 1000) {
  ctx.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: maxAgeMs
  })
}

export function verifyAccessToken(accessToken: string) {
  try {
    const data = jwt.verify(accessToken, process.env.JWT_SECRET as Secret, {
      algorithms: ["HS256"]
    })
    const parsed = accessTokenUserSchema.safeParse(data)
    if (!parsed.success) throw new Error();
    return parsed.data;
  } catch {
    return null
  }
}
import { SafeUser } from "../types/user";
import { randomUUID, sign } from "crypto";
import jwt, { Algorithm, Secret, SignOptions } from 'jsonwebtoken'
import { RefreshModel } from "./refreshModel";
import { Context } from "koa";

const REFRESH_EXPIRE_SEC = 18 * 24 * 60 * 60;


export function signAccessToken(user: SafeUser) {
  return jwt.sign(
    { name: user.name, roles: user.roles },
    (process.env.JWT_SECRET as Secret),
    { 
      algorithm: (process.env.JWT_ALGORITHM as Algorithm),
      subject: user._id.toString(),
      expiresIn: 900,
      issuer: "sshs-ocw"
    } satisfies SignOptions
  )
}

export async function mintRefreshToken(user: SafeUser) {
  const jti = randomUUID();
  const expSec = Math.floor(Date.now() / 1000) + REFRESH_EXPIRE_SEC;
  await RefreshModel.create({
    jti: jti, 
    userId: user._id,
    expiresAt: new Date(expSec * 1000)
  })

  const refreshToken = jwt.sign(
    { sub: user._id },
    process.env.REFRESH_JWT_SECRET as Secret,
    { 
      algorithm: process.env.JWT_ALGORITHM as Algorithm, 
      expiresIn: REFRESH_EXPIRE_SEC,
      jwtid: jti,
      issuer: "sshs-ocw"
    }
  )

  return refreshToken
}

export function setRefreshCookie(ctx: Context, refreshToken: string, maxAgeMs = REFRESH_EXPIRE_SEC * 1000) {
  ctx.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    path: "/auth/refresh",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeMs
  })
}
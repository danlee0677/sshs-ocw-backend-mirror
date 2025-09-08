import { Context, Next } from "koa";
import Router from "@koa/router";
import passport from "koa-passport";
import jwt, { Algorithm, Secret } from 'jsonwebtoken'
import { RefreshModel } from "../refresh/refreshModel";
import { UserModel } from "./userModel";
import { mintRefreshToken, signAccessToken, setRefreshCookie } from "../refresh/refreshUtils";

const userRouter = new Router();

userRouter.get("/api/auth/login/google", 
  passport.authenticate('google', { scope: ['profile'], session: false }));

userRouter.get("/api/auth/login/google/callback", 
  passport.authenticate('google', { session: false }),
  async function(ctx: Context, next: Next) {
    const user = ctx.state.user;
    if (user) {
      const accessToken = signAccessToken(user);
      const refresh = await mintRefreshToken(user);
      setRefreshCookie(ctx, refresh);
      ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900}
      
      ctx.status = 200;
    } else {
      ctx.throw(401, "Invalid User")
    }

    await next()
  });


userRouter.get("/api/auth/login/kakao", 
  passport.authenticate('kakao', { session: false }));

userRouter.get("/api/auth/login/kakao/callback",
  passport.authenticate('kakao', { session: false }),
  async function(ctx: Context, next: Next) {
    const user = ctx.state.user;
    if (user) {
      const accessToken = signAccessToken(user);
      const refresh = await mintRefreshToken(user);
      setRefreshCookie(ctx, refresh);
      ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900}
      
      ctx.status = 200;
    } else {
      ctx.throw(401, "Invalid User")
    }

    await next()
  })


userRouter.get("/api/auth/login/naver", 
  passport.authenticate('naver', { session: false }))

userRouter.get("/api/auth/login/naver/callback", 
  passport.authenticate('naver', { session: false }),
  async function (ctx: Context, next: Next) {
    const user = ctx.state.user;
    if (user) {
      const accessToken = signAccessToken(user);
      const refresh = await mintRefreshToken(user);
      setRefreshCookie(ctx, refresh);
      ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900}
      
      ctx.status = 200;
    } else {
      ctx.throw(401, "Invalid User")
    }
  })


userRouter.post("/api/auth/refresh", async function(ctx: Context, next: Next) {
  const refreshToken = ctx.cookies.get("refresh_token")
  ctx.assert(refreshToken, 401, "No refresh token");

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET as Secret, {
      algorithms: [process.env.JWT_ALGORITHM as Algorithm],
      issuer: "sshs-ocw"
    }) as jwt.JwtPayload;
    
    ctx.assert(payload, 401, "Invalid refresh");

    const { sub: userId, jti } = payload;
    ctx.assert(userId && jti, 401, "Invalid refresh");

    const refresh = await RefreshModel.findOne({ jti: jti }).exec();
    ctx.assert(refresh, 401, "Unknown refresh")

    if (refresh.usedAt) {
      refresh.expiresAt = new Date()
      await refresh.save()
      ctx.throw(401, "Refresh already used");
    }

    ctx.assert(refresh.expiresAt.getTime() >= Date.now(), 401, "Expired refresh")
    
    const user = await UserModel.findById(userId).select({roles: 1, name: 1, _id: 1}).lean().exec();
    ctx.assert(user, 401, "User not found")

    refresh.usedAt = new Date()
    refresh.expiresAt = new Date()
    await refresh.save();

    const accessToken = signAccessToken({_id: user._id, name: user.name, roles: user.roles});
    const newRefresh = await mintRefreshToken(user);
    setRefreshCookie(ctx, newRefresh)
    ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900 }

    ctx.status = 200;
  } catch (err) {
    ctx.throw(401, "Invalid refresh")
  }
  await next();
})

userRouter.post("/api/auth/logout", async function(ctx: Context, next: Next) {
  const refreshToken = ctx.cookies.get("refresh_token");
  if (refreshToken) {
    try {
      const { jti } = jwt.decode(refreshToken) as any || {};
      if (jti) await RefreshModel.updateOne({jti: jti}, {$set : {expiresAt: Date.now()}});
    } catch {}
  }
  ctx.cookies.set("refresh_token", "", {
    httpOnly: true, 
    maxAge: 0,
    path: "/auth/refresh"
  })
  ctx.status = 204;
  await next()
})

export default userRouter;
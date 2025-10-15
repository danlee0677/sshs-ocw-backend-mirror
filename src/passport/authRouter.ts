import { Context, Next } from "koa";
import Router from "@koa/router";
import passport from "koa-passport";
import jwt, { Algorithm, Secret } from 'jsonwebtoken'
import { RefreshModel } from "../refresh/refreshModel";
import { UserModel } from "../user/userModel";
import { mintRefreshToken, signAccessToken, setRefreshCookie, verifyAccessToken } from "../refresh/refreshUtils";
import { z } from 'zod'
import { ContextUser } from "../types/user";

const authRouter = new Router();

const STATE_SECRET = process.env.STATE_SECRET as string

function parsePrefs(ctx: Context): string {
  const parsed = z.object({
    prefs: z.string(),
  }).safeParse(ctx.query)
  ctx.assert(parsed.success, 400)

  const splitData = parsed.data.prefs.split(".")
  ctx.assert(splitData.length === 2, 400)

  const [preferenceMaskStr, studyLevelMaskStr] = splitData
  let preferenceMask: number, studyLevelMask: number

  try {
    preferenceMask = parseInt(preferenceMaskStr)
    studyLevelMask = parseInt(studyLevelMaskStr)
  } catch {
    ctx.throw(400);
  }

  return jwt.sign({
    preferenceMask: preferenceMask,
    studyLevelMask: studyLevelMask
  }, STATE_SECRET, { expiresIn: "5m", algorithm: "HS256" })
}

function maskToArr(mask: number, len: number) {
  return Array.from({length: len}, (_, i) => ((mask >> i) & 1) == 1);
}

async function decodePrefToken(ctx: Context, user: ContextUser) {
  const token = ctx.query.state
  ctx.assert(typeof token === "string", 400);

  const state = jwt.verify(token, STATE_SECRET, { algorithms: ["HS256"]})

  const parsed = z.object({
    preferenceMask: z.number(),
    studyLevelMask: z.number(),
  }).safeParse(state)
  
  ctx.assert(parsed.success, 400);
  
  const preference = maskToArr(parsed.data.preferenceMask, 6);
  const studyLevel = maskToArr(parsed.data.studyLevelMask, 4);

  const new_user = await UserModel.findByIdAndUpdate(user._id, {
    preference: preference,
    studyLevel: studyLevel,
  }, {new: true}).exec()
  ctx.assert(new_user, 400);

  return new_user
}

authRouter.get("/api/auth/login/google", async function (ctx: Context, next: Next) {
    const state = parsePrefs(ctx)
    
    return passport.authenticate(
      'google', { state: state, scope: ['profile'], session: false }
    )(ctx, next);
  });

authRouter.get("/api/auth/login/google/callback", 
  passport.authenticate('google', { session: false }),
  async function(ctx: Context, next: Next) {
    if (ctx.state.user) {
      const user = await decodePrefToken(ctx, ctx.state.user);
      const refresh = await mintRefreshToken(user);
      setRefreshCookie(ctx, refresh);
      
      ctx.status = 200;
      ctx.redirect(`${process.env.FRONTEND_URL}/login/complete`)
    } else {
      ctx.throw(401, "Invalid User")
    }

    await next()
  });


authRouter.get("/api/auth/login/kakao", async function(ctx: Context, next: Next) {
    const state = parsePrefs(ctx)

    return passport.authenticate('kakao', { state: state, session: false })(ctx, next);
  });

authRouter.get("/api/auth/login/kakao/callback",
  passport.authenticate('kakao', { session: false }),
  async function(ctx: Context, next: Next) {
    if (ctx.state.user) {
      const user = await decodePrefToken(ctx, ctx.state.user)

      const accessToken = signAccessToken(user);
      const refresh = await mintRefreshToken(user);
      setRefreshCookie(ctx, refresh);
      ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900}
      
      ctx.status = 200;

      ctx.redirect(`${process.env.FRONTEND_URL}/login/complete`)
    } else {
      ctx.throw(401, "Invalid User")
    }

    await next()
  })


authRouter.get("/api/auth/login/naver", async function (ctx: Context, next: Next) {
    const state = parsePrefs(ctx)

    return passport.authenticate('naver', { state: state, session: false })(ctx, next);
  })

authRouter.get("/api/auth/login/naver/callback", 
  passport.authenticate('naver', { session: false }),
  async function (ctx: Context, next: Next) {
    if (ctx.state.user) {
      const user = await decodePrefToken(ctx, ctx.state.user);

      const refresh = await mintRefreshToken(user);
      setRefreshCookie(ctx, refresh);
      
      ctx.status = 200;
      ctx.redirect(`${process.env.FRONTEND_URL}/login/complete`)
    } else {
      ctx.throw(401, "Invalid User")
    }

  })


authRouter.post("/api/auth/refresh", async function(ctx: Context, next: Next) {
  const refreshToken = ctx.cookies.get("refresh_token")
  ctx.assert(refreshToken, 401, "No refresh token");

  try {
    const payload: jwt.JwtPayload = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET as Secret, {
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
    
    const user = await UserModel.findById(userId).lean().exec();
    ctx.assert(user, 401, "User not found")

    refresh.usedAt = new Date()
    refresh.expiresAt = new Date()
    await refresh.save();

    const accessToken = signAccessToken(user);
    const newRefresh = await mintRefreshToken(user);
    setRefreshCookie(ctx, newRefresh)
    ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900 }

    ctx.status = 200;
  } catch (err) {
    ctx.throw(401, "Invalid refresh")
  }
  await next();
})

authRouter.post("/api/auth/logout", async function(ctx: Context, next: Next) {
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

authRouter.get("/api/auth/verify", async function (ctx: Context, next: Next) {
  const data = ctx.get("Authorization")
  ctx.assert(/^Bearer\s+.+/.test(data), 401)
  const token = data.replace(/^Bearer\s+/, "");
  const payload = verifyAccessToken(token)
  
  ctx.assert(payload, 401);
  
  ctx.body = payload
  ctx.status = 200

  await next()
})

export default authRouter;
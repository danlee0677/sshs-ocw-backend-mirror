import { Context, Next } from "koa";
import Router from "@koa/router";
import passport from "koa-passport";
import jwt, { Algorithm, Secret } from 'jsonwebtoken'
import { RefreshModel } from "../refresh/refreshModel";
import { UserModel } from "../user/userModel";
import { mintRefreshToken, signAccessToken, setRefreshCookie, verifyAccessToken } from "../refresh/refreshUtils";
import { z } from 'zod'

const authRouter = new Router();

const STATE_SECRET = process.env.STATE_SECRET as string

function parseUsername(ctx: Context): string {
  const parsed = z.object({
    username: z.string(),
  }).safeParse(ctx.query)
  ctx.assert(parsed.success, 400)

  const token = jwt.sign({ username: parsed.data.username }, STATE_SECRET, { algorithm: "HS256", expiresIn: "5m" });

  return token
}

authRouter.get("/api/auth/login/google", async function (ctx: Context, next: Next) {
  const state = parseUsername(ctx);

  return passport.authenticate(
    'google', { state: state, scope: ['profile', 'email'], session: false }
  )(ctx, next);
});

authRouter.get("/api/auth/login/google/callback", async (ctx: Context, next: Next) => {
  return passport.authenticate('google', { session: false }, async (err, user, info, status) => {
    if (err) {
      const errorMessage = encodeURIComponent(err.message);
      ctx.redirect(`${process.env.FRONTEND_URL}?error=${errorMessage}`)
      return;
    }

    if (!user) {
      ctx.redirect(`${process.env.FRONTEND_URL}?error=AuthenticationFailed`)
      return;
    }

    const { token: refresh } = await mintRefreshToken(user._id);
    setRefreshCookie(ctx, refresh);

    ctx.status = 200;
    ctx.redirect(`${process.env.FRONTEND_URL}/home`)

  })(ctx, next);
});


authRouter.get("/api/auth/login/kakao", async function (ctx: Context, next: Next) {
  const state = parseUsername(ctx);

  return passport.authenticate('kakao', 
    { state: state, session: false }
  )(ctx, next);
});

authRouter.get("/api/auth/login/kakao/callback", async (ctx: Context, next: Next) => {
  return passport.authenticate('kakao', { session: false }, async (err, user, info, status) => {
    if (err) {
      const errorMessage = encodeURIComponent(err.message);
      ctx.redirect(`${process.env.FRONTEND_URL}?error=${errorMessage}`)
      return;
    }

    if (!user) {
      ctx.redirect(`${process.env.FRONTEND_URL}?error=AuthenticationFailed`)
      return;
    }

    const { token: refresh } = await mintRefreshToken(user._id);
    setRefreshCookie(ctx, refresh);

    ctx.status = 200;
    ctx.redirect(`${process.env.FRONTEND_URL}/home`)

  })(ctx, next);
});


authRouter.get("/api/auth/login/naver", async function (ctx: Context, next: Next) {
  const state = parseUsername(ctx);

  return passport.authenticate('naver', 
    { state: state, session: false }
  )(ctx, next);
})

authRouter.get("/api/auth/login/naver/callback", async (ctx: Context, next: Next) => {
  return passport.authenticate('naver', { session: false }, async (err, user, info, status) => {
    if (err) {
      const errorMessage = encodeURIComponent(err.message);
      ctx.redirect(`${process.env.FRONTEND_URL}?error=${errorMessage}`)
      return;
    }

    if (!user) {
      ctx.redirect(`${process.env.FRONTEND_URL}?error=AuthenticationFailed`)
      return;
    }

    const { token: refresh } = await mintRefreshToken(user._id);
    setRefreshCookie(ctx, refresh);

    ctx.status = 200;
    ctx.redirect(`${process.env.FRONTEND_URL}/home`)

  })(ctx, next);
});


authRouter.post("/api/auth/refresh", async function (ctx: Context, next: Next) {
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

    const grace_period = 15000; // 15s

    const refresh = await RefreshModel.findOneAndUpdate({
      jti: jti, userId: userId, usedAt: null,
    }, {
      $set: {
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + grace_period),
      }
    }, { new: true }).exec();

    if (!refresh) {
      const usedToken = await RefreshModel.findOne({ jti: jti, userId: userId });

      if (usedToken && usedToken.usedAt) {
        if (new Date().getTime() - usedToken.usedAt.getTime() < grace_period) {
          let replacementJti: string | null | undefined = usedToken.replacedBy;
          let attempts = 0;

          while (!replacementJti && attempts < 5) {
            await new Promise(r => setTimeout(r, 500)); // Wait 500ms
            const updated = await RefreshModel.findById(usedToken._id).lean().exec();
            replacementJti = updated?.replacedBy;
            attempts++;
          }

          if (replacementJti) {
            const alreadyCreatedToken = await RefreshModel.findOne({ jti: replacementJti, userId: userId });

            if (alreadyCreatedToken) {
              const user = await UserModel.findById(userId).lean().exec();
              if (user) {
                const accessToken = await signAccessToken(user);
                setRefreshCookie(ctx, alreadyCreatedToken.token);

                ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900 };
                ctx.status = 200;
                return await next();
              }
            }
          }
        } else {
          // remove all refresh tokens for the user
          await RefreshModel.deleteMany({ userId: userId }).exec();
          ctx.throw(401, "Security Alert: Token Reuse");
        }
      }
      ctx.throw(401, "Invalid refresh")
    }

    const user = await UserModel.findById(userId).lean().exec();

    ctx.assert(user, 401, "Corresponding user does not exist");

    const accessToken = await signAccessToken(user);
    const { token: newRefresh, jti: newJti } = await mintRefreshToken(user._id);

    await RefreshModel.updateOne(
      { _id: refresh._id },
      { $set: { replacedBy: newJti } }
    )

    setRefreshCookie(ctx, newRefresh);
    ctx.body = { token: accessToken, token_type: "Bearer", expires_in: 900 }
    ctx.status = 200;
  } catch (err: any) {
    if (err.status)
      ctx.throw(401, "Invalid refresh")
  }
  await next();
})

authRouter.post("/api/auth/logout",
  passport.authenticate('jwt', { session: false }),
  async function (ctx: Context, next: Next) {
    if (!ctx.state.user) throw new Error("user not found: passport not mounted?")
    await RefreshModel.deleteMany({ userId: ctx.state.user._id }).exec();
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

  // fix user
  ctx.body = {
    _id: payload._id,
    username: payload.username,
    roles: payload.roles,
    liked_subject: payload.liked_subject,
    pfp_url: payload.pfp_url,
    achievement: payload.achievement,
    email: payload.email,
    description: payload.description,
  }
  ctx.status = 200

  await next()
})

authRouter.post("/api/auth/check-username", async (ctx: Context, next: Next) => {
  const parsed = z.object({ username: z.string() }).safeParse(ctx.request.body);
  ctx.assert(parsed.success, 400, "Failed to find username");

  const user = await UserModel.findOne({ username: parsed.data.username }).lean().exec();

  ctx.status = 200;
  if (user) {
    ctx.body = { available: false };
  } else {
    ctx.body = { available: true };
  }
})

export default authRouter;
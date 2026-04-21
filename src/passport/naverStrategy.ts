import { NaverStrategy, NaverProfile } from "./naver-passport";
import { UserModel } from "../user/userModel";
import { ProviderModel } from "./providerModel";
import jwt, { type Secret } from 'jsonwebtoken';
import z from "zod";

export var naverStrategy = new NaverStrategy({
  clientID: process.env.NAVER_CLIENT_ID || "",
  clientSecret: process.env.NAVER_CLIENT_SECRET || "",
  callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/naver/callback`,
}, async function (req, accessToken: String, refreshToken: String, profile: NaverProfile, cb: any) {
  try {
    const provider = await ProviderModel.findOne({ provider: "naver", providerUserId: profile.id });
    
    if (provider) {
      const user = await UserModel.findById(provider.userId)
      if (user) { 
        return await cb(null, {
          username: user.username,
          _id: user._id,
          roles: user.roles,
          pfp_url: user.pfp_url, 
          liked_subject: user.liked_subject,
          email: user.email,
        })
      } else {
        await ProviderModel.findByIdAndDelete(provider._id);
      }
    }

    const state = req.query?.state as string;
    if (!state) return cb(new Error("State token missing for new user registration"))

    const decoded = jwt.verify(state, (process.env.STATE_SECRET ?? "") satisfies Secret, { algorithms: ["HS256"] })
    const parsed = z.object({ username: z.string() }).safeParse(decoded)
    if (!parsed.success) return cb(new Error("Failed to parse state token"));

    if (parsed.data.username.length === 0)
      return cb(new Error("NoUsername"));
    
    const usernameExists = await UserModel.exists({ username: parsed.data.username });
    if (usernameExists)
      return cb(new Error("DuplicateUsername"));

    const new_user = await UserModel.create({
      username: parsed.data.username,
      roles: ['user'],
      liked_subject: [],
      email: profile.emails ? profile.emails[0].value : "no_email",
    })

    await ProviderModel.create({
      provider: "naver",
      providerUserId: profile.id,
      userId: new_user._id,
    })

    return await cb(null, {
      username: new_user.username,
      roles: new_user.roles,
      _id: new_user._id,
      pfp_url: new_user.pfp_url,
      liked_subject: new_user.liked_subject,
      email: new_user.email,
    });
  } catch (err) {
    console.log(err);
    return cb(err);
  }
})
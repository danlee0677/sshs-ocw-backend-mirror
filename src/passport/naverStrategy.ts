import { NaverStrategy, NaverProfile } from "./naver-passport";
import { UserModel } from "../user/userModel";
import { ProviderModel } from "./providerModel";
import jwt, { type Secret } from 'jsonwebtoken';
import z from "zod";
import { usernameSchema } from "../user/userType";
import { describe } from "node:test";

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
          achievement: user.achievement,
          email: user.email,
          description: user.description,
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

    const usernameParsed = usernameSchema.safeParse(parsed.data.username);
    if (!usernameParsed.success)
      return cb(new Error("InvalidUsername"));
    const username = usernameParsed.data;
    
    const usernameExists = await UserModel.exists({ username: username });
    if (usernameExists)
      return cb(new Error("DuplicateUsername"));

    const new_user = await UserModel.create({
      username: username,
      roles: ['user'],
      liked_subject: [],
      achievement: [],
      email: profile.emails ? profile.emails[0].value : "no_email",
      description: "",
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
      achievement: new_user.achievement,
      email: new_user.email,
      description: new_user.description,
    });
  } catch (err: any) {
    // Lost the race between the exists() check and create(): unique index on username
    if (err?.code === 11000) return cb(new Error("DuplicateUsername"));
    console.log(err);
    return cb(err);
  }
})
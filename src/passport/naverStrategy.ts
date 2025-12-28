import { Strategy as NaverStrategy, Profile } from "passport-naver";
import passport from 'koa-passport'
import { UserModel } from "../user/userModel";
import { ProviderModel } from "./providerModel";

export var naverStrategy = new NaverStrategy({
  clientID: process.env.NAVER_CLIENT_ID || "",
  clientSecret: process.env.NAVER_CLIENT_SECRET || "",
  callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/naver/callback`,
  
}, async function (accessToken: String, refreshToken: String, profile: Profile, cb: any) {
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
      })
    } else {
      await ProviderModel.findByIdAndDelete(provider._id);
    }
  }
  try {
    const new_user = await UserModel.create({
      name: "default-user",
      roles: ['user'],
      liked_subject: [],
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
      liked_subject: new_user.liked_subject
    });
  } catch (err) {
    return cb(err);
  }
  
})
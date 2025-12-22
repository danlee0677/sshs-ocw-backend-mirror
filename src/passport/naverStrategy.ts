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
        name: user.name,
        _id: user._id,
        roles: user.roles,
        pfp_url: user.pfp_url, 
        preference: user.preference,
        studyLevel: user.studyLevel,
      })
    } else {
      await ProviderModel.findByIdAndDelete(provider._id);
    }
  }
  try {
    const new_user = await UserModel.create({
      name: (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : "unknown"),
      roles: ['user']
    })

    await ProviderModel.create({
      provider: "naver",
      providerUserId: profile.id,
      userId: new_user._id,
      preference: [false, false, false, false, false, false],
      studyLevel: [false, false, false, false]
    })

    return await cb(null, {
      name: new_user.name,
      roles: new_user.roles,
      _id: new_user._id,
      preference: new_user.preference,
      studyLevel: new_user.studyLevel,
      pfp_url: new_user.pfp_url,
    });
  } catch (err) {
    return cb(err);
  }
  
})
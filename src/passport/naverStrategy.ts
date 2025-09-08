import { Strategy as NaverStrategy, Profile } from "passport-naver";
import passport from 'koa-passport'
import { UserModel } from "../user/userModel";

export var naverStrategy = new NaverStrategy({
  clientID: process.env.NAVER_CLIENT_ID || "",
  clientSecret: process.env.NAVER_CLIENT_SECRET || "",
  callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/naver/callback`
}, async function (accessToken: String, refreshToken: String, profile: Profile, cb: any) {
  const user = await UserModel.findOne({naver_id: profile.id});
  if (user) {
    return await cb(null, user)
  } else {
    try {
      const new_user = UserModel.create({
        name: (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : "unknown"),
        naver_id: profile.id,
        roles: ['user']
      })

      console.log((await new_user).toJSON())

      return await cb(null, new_user);
    } catch (err) {
      return cb(err);
    }
  }
})
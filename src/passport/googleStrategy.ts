import passport from 'koa-passport'
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20'
import { UserModel } from '../user/userModel';
import { SafeUser } from '../types/user';


export var googleStrategy = new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/google/callback`
}, async function(accessToken: String, refreshToken: String, profile: Profile, cb: any) {
  const user = await UserModel.findOne({ google_id: profile.id });
  if (user) {
    return cb(null, {
      name: user.name,
      roles: user.roles,
      _id: user._id,
    });
  } else {
    try {
      const new_user = await UserModel.create({
        name: (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : "unknown"),
        google_id: profile.id,
        roles: ['user']
      })
      return await cb(null, {
        name: new_user.name,
        roles: new_user.roles,
        _id: new_user._id,
      });
    } catch (err) {
      return await cb(err);
    }
  }

})
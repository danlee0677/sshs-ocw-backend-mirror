import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20'
import { UserModel } from '../user/userModel';
import { ProviderModel } from './providerModel';


export var googleStrategy = new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/google/callback`
}, async function(accessToken: String, refreshToken: String, profile: Profile, cb: any) {
  const provider = await ProviderModel.findOne({ provider: "google", providerUserId: profile.id })
  if (provider) {
    const user = await UserModel.findById(provider.userId);
    if (user) {
      return cb(null, {
        name: user.name,
        roles: user.roles,
        _id: user._id,
      });
    } else {
      await ProviderModel.findByIdAndDelete(provider._id);
    }
  }
  try {
    // create new user
    const new_user = await UserModel.create({
      name: (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : "unknown"),
      roles: ['user']
    })
    // create new provider
    await ProviderModel.create({
      provider: "google",
      providerUserId: profile.id, // google_id
      userId: new_user._id, // mongodb _id
    })
    
    return await cb(null, {
      name: new_user.name,
      roles: new_user.roles,
      _id: new_user._id,
    });
  } catch (err) {
    return await cb(err);
  }
})
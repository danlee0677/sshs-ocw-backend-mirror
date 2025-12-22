import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20'
import { UserModel } from '../user/userModel';
import { ProviderModel } from './providerModel';


export var googleStrategy = new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/google/callback`,
  passReqToCallback : true
}, async function(req, accessToken: string, refreshToken: string, profile: Profile, cb: any) {
  const provider = await ProviderModel.findOne({ provider: "google", providerUserId: profile.id })
  
  
  if (provider) {
    const user = await UserModel.findById(provider.userId);
    if (user) {
      return cb(null, {
        name: user.name,
        roles: user.roles,
        _id: user._id,
        preference: user.preference,
        studyLevel: user.studyLevel,
        pfp_url: user.pfp_url,
      });
    } else {
      await ProviderModel.findByIdAndDelete(provider._id);
    }
  }
  try {
    // create new user
    const new_user = await UserModel.create({
      name: (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : "unknown"),
      roles: ['user'],
      preference: [false, false, false, false, false, false],
      studyLevel: [false, false, false, false]
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
      preference: new_user.preference,
      studyLevel: new_user.studyLevel,
      pfp_url: new_user.pfp_url,
    });
  } catch (err) {
    console.log(err)
    return await cb(err);
  }
})
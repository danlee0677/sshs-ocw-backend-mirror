import { Strategy as KakaoStrategy, Profile } from 'passport-kakao'
import { UserModel } from '../user/userModel'
import { ProviderModel } from './providerModel';

export var kakaoStrategy = new KakaoStrategy({
    clientID : process.env.KAKAO_CLIENT_ID || "",
    clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/kakao/callback`
  },
  async function (accessToken: String, refreshToken: String, profile: Profile, cb: any) {
    const provider = await ProviderModel.findOne({provider: "kakao", providerUserId: profile.id})
    if (provider) {
      const user = await UserModel.findById(provider.userId);
      if (user) {
        return await cb(null, {
          name: user.name,
          roles: user.roles,
          preference: user.preference,
          studyLevel: user.studyLevel,
          _id: user._id,
          pfp_url: user.pfp_url
        })
      } else {
        await ProviderModel.findByIdAndDelete(provider._id);
      }
    }
    try {
      const new_user = await UserModel.create({
        name: (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : "unknown"),
        roles: ['user'],
        preference: [false, false, false, false, false, false],
        studyLevel: [false, false, false, false],
      })
      
      await ProviderModel.create({
        provider: "kakao",
        providerUserId: profile.id,
        userId: new_user._id,
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
      return await cb(err);
    }
  }
)
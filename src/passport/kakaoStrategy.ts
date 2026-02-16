import { Strategy as KakaoStrategy, Profile } from 'passport-kakao'
import { UserModel } from '../user/userModel'
import { ProviderModel } from './providerModel';

export var kakaoStrategy = new KakaoStrategy({
    clientID : process.env.KAKAO_CLIENT_ID || "",
    clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/kakao/callback`,
  },
  async function (accessToken: String, refreshToken: String, profile: Profile, cb: any) {
    const provider = await ProviderModel.findOne({provider: "kakao", providerUserId: profile.id})

    if (provider) {
      const user = await UserModel.findById(provider.userId);
      if (user) {
        return await cb(null, {
          username: user.username,
          roles: user.roles,
          _id: user._id,
          pfp_url: user.pfp_url,
          liked_subject: user.liked_subject,
        })
      } else {
        await ProviderModel.findByIdAndDelete(provider._id);
      }
    }
    try {
      const new_user = await UserModel.create({
        username: "default-user",
        roles: ['user'],
        liked_subject: [],
        email: "no_email",
      })
      
      await ProviderModel.create({
        provider: "kakao",
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
      return await cb(err);
    }
  }
)
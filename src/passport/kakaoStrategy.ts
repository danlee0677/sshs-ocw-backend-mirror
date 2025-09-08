import { Strategy as KakaoStrategy, Profile } from 'passport-kakao'
import { UserModel } from '../user/userModel'

/*
export interface Profile {
  provider: 'kakao'
  id?: string | number
  username?: string
  displayName?: string
  _raw: string
  _json: string
}
*/

export var kakaoStrategy = new KakaoStrategy({
    clientID : process.env.KAKAO_CLIENT_ID || "",
    clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    callbackURL : `${process.env.BASE_API_URL || ""}/api/auth/login/kakao/callback`
  },
  async function (accessToken: String, refreshToken: String, profile: Profile, cb: any) {
    const user = await UserModel.findOne({kakao_id: profile.id});

    if (user) {
      return await cb(null, user);
    } else {
      try {
        const new_user = await UserModel.create({
          name: (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : "unknown"),
          kakao_id: profile.id,
          roles: ['user']
        })
        return await cb(null, new_user);
      } catch (err) {
        return await cb(err);
      }
    }
  }
)
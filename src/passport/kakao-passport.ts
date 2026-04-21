import { Request } from 'express';
import OAuth2Strategy, { InternalOAuthError, StrategyOptionsWithRequest, VerifyCallback } from "passport-oauth2";

const MAX_PROFILE_BODY_BYTES = 65_536;
const ALLOWED_PROFILE_ORIGIN = 'https://kapi.kakao.com';

export interface KakaoStrategyOptions {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  authorizationURL?: string;
  tokenURL?: string;
  profileURL?: string;
}

export interface KakaoProfileResponse {
  id: number;
  connected_at: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
  };
}

export interface KakaoProfile {
  provider: 'kakao';
  id: string;
  displayName: string;
  username?: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
  _raw: string;
  _json: KakaoProfileResponse;
}

export type KakaoVerifyFunction = (
  req: Request,
  accessToken: string,
  refreshToken: string,
  profile: KakaoProfile,
  done: VerifyCallback
) => void;

export class KakaoStrategy extends OAuth2Strategy {
  public name: string;
  private _profileURL: string;

  constructor(options: KakaoStrategyOptions, verify: KakaoVerifyFunction) {
    if (!options.clientID) throw new Error('KakaoStrategy requires clientID');
    if (!options.clientSecret) throw new Error('KakaoStrategy requires clientSecret');
    if (!options.callbackURL) throw new Error('KakaoStrategy requires callbackURL');

    const profileURL = options.profileURL ?? 'https://kapi.kakao.com/v2/user/me';

    let origin: string;
    try {
      origin = new URL(profileURL).origin;
    } catch {
      throw new Error('KakaoStrategy: profileURL is not a valid URL');
    }
    if (origin !== ALLOWED_PROFILE_ORIGIN) {
      throw new Error(`KakaoStrategy: profileURL must originate from ${ALLOWED_PROFILE_ORIGIN}`);
    }

    const finalOptions: StrategyOptionsWithRequest = {
      clientID: options.clientID,
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      authorizationURL: options.authorizationURL ?? 'https://kauth.kakao.com/oauth/authorize',
      tokenURL: options.tokenURL ?? 'https://kauth.kakao.com/oauth/token',
      passReqToCallback: true,
    };

    super(finalOptions, verify);

    this.name = 'kakao';
    this._profileURL = profileURL;
  }

  userProfile(accessToken: string, done: (err?: Error | null, profile?: KakaoProfile) => void): void {
    this._oauth2.get(this._profileURL, accessToken, (err, body, _res) => {
      if (err) {
        console.error('KakaoStrategy profile fetch error:', err);
        return done(new InternalOAuthError('Failed to fetch user profile', err));
      }

      if (body == null) {
        return done(new Error('Empty profile response from Kakao'));
      }

      const raw = typeof body === 'string' ? body : body.toString('utf-8');

      if (raw.length > MAX_PROFILE_BODY_BYTES) {
        return done(new Error('Profile response exceeds maximum allowed size'));
      }

      try {
        const json: KakaoProfileResponse = JSON.parse(raw);

        if (typeof json.id !== 'number') {
          return done(new Error('Invalid profile response: missing numeric id'));
        }

        const profile: KakaoProfile = {
          provider: 'kakao',
          id: String(json.id),
          displayName: json.kakao_account?.profile?.nickname ?? json.properties?.nickname ?? '',
          username: json.kakao_account?.profile?.nickname ?? json.properties?.nickname,
          _raw: raw,
          _json: json,
        };

        if (json.kakao_account?.email) {
          profile.emails = [{ value: json.kakao_account.email }];
        }

        if (json.kakao_account?.profile?.profile_image_url) {
          profile.photos = [{ value: json.kakao_account.profile.profile_image_url }];
        }

        done(null, profile);
      } catch (e) {
        done(e as Error);
      }
    });
  }
}

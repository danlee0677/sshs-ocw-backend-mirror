import { Request } from 'express';
import OAuth2Strategy, { InternalOAuthError, StrategyOptionsWithRequest, VerifyCallback } from "passport-oauth2";

const MAX_PROFILE_BODY_BYTES = 65_536;
const ALLOWED_PROFILE_ORIGIN = 'https://openapi.naver.com';

export interface NaverStrategyOptions {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  authorizationURL?: string;
  tokenURL?: string;
  profileURL?: string;
}

export interface NaverProfileResponse {
  resultcode: string;
  message: string;
  response: {
    id: string;
    nickname?: string;
    name?: string;
    email?: string;
    gender?: string;
    age?: string;
    birthday?: string;
    profile_image?: string;
  };
}

export interface NaverProfile {
  provider: 'naver';
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
  _raw: string;
  _json: NaverProfileResponse;
}

export type NaverVerifyFunction = (
  req: Request,
  accessToken: string,
  refreshToken: string,
  profile: NaverProfile,
  done: VerifyCallback
) => void;

export class NaverStrategy extends OAuth2Strategy {
  public name: string;
  private _profileURL: string;

  constructor(options: NaverStrategyOptions, verify: NaverVerifyFunction) {
    if (!options.clientID) throw new Error('NaverStrategy requires clientID');
    if (!options.clientSecret) throw new Error('NaverStrategy requires clientSecret');
    if (!options.callbackURL) throw new Error('NaverStrategy requires callbackURL');

    const profileURL = options.profileURL ?? 'https://openapi.naver.com/v1/nid/me';

    let origin: string;
    try {
      origin = new URL(profileURL).origin;
    } catch {
      throw new Error('NaverStrategy: profileURL is not a valid URL');
    }
    if (origin !== ALLOWED_PROFILE_ORIGIN) {
      throw new Error(`NaverStrategy: profileURL must originate from ${ALLOWED_PROFILE_ORIGIN}`);
    }

    const finalOptions: StrategyOptionsWithRequest = {
      clientID: options.clientID,
      clientSecret: options.clientSecret,
      callbackURL: options.callbackURL,
      authorizationURL: options.authorizationURL ?? 'https://nid.naver.com/oauth2.0/authorize',
      tokenURL: options.tokenURL ?? 'https://nid.naver.com/oauth2.0/token',
      passReqToCallback: true,
    };

    super(finalOptions, verify);

    this.name = 'naver';
    this._profileURL = profileURL;
  }

  userProfile(accessToken: string, done: (err?: Error | null, profile?: NaverProfile) => void): void {
    this._oauth2.get(this._profileURL, accessToken, (err, body, _res) => {
      if (err) {
        console.error('NaverStrategy profile fetch error:', err);
        return done(new InternalOAuthError('Failed to fetch user profile', err));
      }

      if (body == null) {
        return done(new Error('Empty profile response from Naver'));
      }

      const raw = typeof body === 'string' ? body : body.toString('utf-8');

      if (raw.length > MAX_PROFILE_BODY_BYTES) {
        return done(new Error('Profile response exceeds maximum allowed size'));
      }

      try {
        const json: NaverProfileResponse = JSON.parse(raw);

        if (!json.response || typeof json.response.id !== 'string') {
          return done(new Error('Invalid profile response: missing response.id'));
        }

        const r = json.response;
        const profile: NaverProfile = {
          provider: 'naver',
          id: r.id,
          displayName: r.name ?? r.nickname ?? r.id,
          _raw: raw,
          _json: json,
        };

        if (r.email) profile.emails = [{ value: r.email }];
        if (r.profile_image) profile.photos = [{ value: r.profile_image }];

        done(null, profile);
      } catch (e) {
        done(e as Error);
      }
    });
  }
}

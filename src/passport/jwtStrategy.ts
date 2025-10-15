import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from "passport-jwt";

const opts: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || "",
  algorithms: [(process.env.JWT_ALGORITHM || "HS256") as any],
  issuer: "sshs-ocw",
  ignoreExpiration: false
}

export var jwtStrategy = new JwtStrategy(opts, async function(payload: any, cb) {
  try {
    if (!payload.sub) return cb(null, false, { message: "Invalid Token" })
    
    return cb(null, {
      id: payload.sub,
      name: payload.name,
      roles: payload.roles,
      preference: payload.preference,
      studyLevel: payload.studyLevel,
    })
    
  } catch (err) {
    return cb(err, false);
  }
})
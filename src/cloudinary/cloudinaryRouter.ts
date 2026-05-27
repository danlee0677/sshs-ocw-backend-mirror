import { v2 as cloudinary } from 'cloudinary'
import Router from '@koa/router'
import passport from 'koa-passport'
import { Context, Next } from 'koa';
import ratelimit from 'koa-ratelimit'

const db = new Map();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const apiLimit = ratelimit({
  driver: 'memory',
  db: db,
  duration: 60000,
  errorMessage: "Too frequent upload, try again later.",
  id: (ctx: Context) => {
    return ctx.state.user ? ctx.state.user._id.toString() : ctx.ip
  },
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total',
  },
  max: 10,
  disableHeader: false,
  whitelist: (ctx: Context) => {
    return !!ctx.state.user && ctx.state.user.roles.includes('admin')
  }
})

const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

const cloudinaryRouter = new Router();

cloudinaryRouter.get('/api/image/sign-upload',
  passport.authenticate("jwt", { session: false }),
  apiLimit,
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("Failed to get user, passport failure");
    
    const timestamp = Math.round((new Date).getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request({
      timestamp: timestamp,
    }, API_SECRET)

    ctx.status = 200;

    ctx.body = {
      timestamp: timestamp,
      signature: signature,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY
    }
  }
)

export default cloudinaryRouter;
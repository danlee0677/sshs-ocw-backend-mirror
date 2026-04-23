import { v2 as cloudinary } from 'cloudinary'
import Router from '@koa/router'
import passport from 'koa-passport'
import { Context, Next } from 'koa';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

const cloudinaryRouter = new Router();

cloudinaryRouter.get('/api/image/sign-upload',
  passport.authenticate("jwt", { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("Failed to get user, passport failure");
    
    // add api limit to normal users

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
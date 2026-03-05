import 'dotenv/config'
import Koa from 'koa';
import mongoose from 'mongoose';
import bodyParser from 'koa-bodyparser';
import passport from 'koa-passport';
import cors from '@koa/cors'
import { googleStrategy } from './passport/googleStrategy';
import { naverStrategy } from './passport/naverStrategy';
import { kakaoStrategy } from './passport/kakaoStrategy';
import { jwtStrategy } from './passport/jwtStrategy';
import lectureRouter from './lecture/lectureRouter';
import authRouter from './passport/authRouter';
import progressRouter from './progress/progressRouter';
import userRouter from './user/userRouter';
import searchRouter from './search/searchRouter';
import cloudinaryRouter from './cloudinary/cloudinaryRouter';
import permissionRouter from './permission/permissionRouter';

import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const PORT = process.env.PORT || 8080
const MONGODB_URI = process.env.MONGODB_URI || "";

// mongoose connection
mongoose.connect(MONGODB_URI);

mongoose.connection.on('error', err =>
  console.error('MongoDB connection failure:', err)
);

mongoose.connection.once('open', () =>
  console.log('Successful connection to MongoDB')
);

const app = new Koa()

app.proxy = true;

const FRONTEND_URL = process.env.FRONTEND_URL

app.use(cors({
  origin: (ctx) => {
    if (process.env.NODE_ENV !== 'production') {
      // Dev: reflect any origin so localhost:3000 → localhost:3001 works without restriction
      return ctx.request.header.origin || ''
    }
    // Production: only allow the configured frontend origin
    const requestOrigin = ctx.request.header.origin
    if (FRONTEND_URL && requestOrigin === FRONTEND_URL) return FRONTEND_URL
    return ''
  },
  credentials: true,
}));

app.use(bodyParser())

// passport

passport.use('jwt', jwtStrategy)
passport.use('google', googleStrategy)
passport.use('naver', naverStrategy)
passport.use('kakao', kakaoStrategy)


// app routes
app.use(passport.initialize())

app.use(lectureRouter.routes())
app.use(authRouter.routes())
app.use(progressRouter.routes())
app.use(userRouter.routes())
app.use(searchRouter.routes())
app.use(cloudinaryRouter.routes());
app.use(permissionRouter.routes());

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
});
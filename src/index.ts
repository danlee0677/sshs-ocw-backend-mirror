import 'dotenv/config'
import Koa from 'koa';
import mongoose from 'mongoose';
import bodyParser from 'koa-bodyparser';
import passport from 'koa-passport';
import { googleStrategy } from './passport/googleStrategy';
import { naverStrategy } from './passport/naverStrategy';
import { kakaoStrategy } from './passport/kakaoStrategy';
import { jwtStrategy } from './passport/jwtStrategy';
import lectureRouter from './lecture/lectureRouter';
import userRouter from './user/userRouter';
import progressRouter from './progress/progressRouter';

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

app.use(bodyParser())



// passport

passport.use('jwt', jwtStrategy)
passport.use('google', googleStrategy)
passport.use('naver', naverStrategy)
passport.use('kakao', kakaoStrategy)


// app routes
app.use(passport.initialize())

app.use(lectureRouter.routes())
app.use(userRouter.routes())

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
});
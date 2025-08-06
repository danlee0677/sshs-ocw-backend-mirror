import Koa from 'koa';
import mongoose from 'mongoose';
import bodyParser from 'koa-bodyparser';
import dotenv from 'dotenv';
import lectureRouter from './lecture/lectureRouter';

dotenv.config();

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

// app routes
app.use(lectureRouter.routes())

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
});
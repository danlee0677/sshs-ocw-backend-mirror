import Koa from 'koa';
import mongoose from 'mongoose';
import bodyParser from 'koa-bodyparser';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 8080
const MONGODB_URI = process.env.MONGODB_URI || "";

mongoose.connect(MONGODB_URI);

const app = new Koa();

app.use(bodyParser())



app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
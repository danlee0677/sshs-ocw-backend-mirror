import { Types } from "mongoose";

export interface SafeUser {
  _id: Types.ObjectId,
  name: string,
  roles: Array<string>
}
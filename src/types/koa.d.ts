import "koa"
import { SafeUser } from "./user"

declare module "koa" {
  interface DefaultState {
    user?: SafeUser
  }
}
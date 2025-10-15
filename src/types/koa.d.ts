import "koa"
import { ContextUser } from "./user"

declare module "koa" {
  interface DefaultState {
    user?: ContextUser
  }
}
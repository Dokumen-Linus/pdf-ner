import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie as getServerCookie } from "@tanstack/react-start/server"
import Cookies from "js-cookie"

export function getCookie(name: string, defaultValue?: string) {
  return createIsomorphicFn()
    .server(() => getServerCookie(name) || defaultValue)
    .client(() => Cookies.get(name) || defaultValue)()
}

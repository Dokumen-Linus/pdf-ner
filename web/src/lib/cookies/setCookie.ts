import { createIsomorphicFn } from "@tanstack/react-start"
import {
  deleteCookie as deleteServerCookie,
  setCookie as setServerCookie,
} from "@tanstack/react-start/server"
import Cookies from "js-cookie"

function expiresDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

export const setCookie = createIsomorphicFn()
  .server((name: string, value?: string, expires?: number) => {
    if (value) setServerCookie(name, value, { expires: expiresDate(expires || 7) })
    else deleteServerCookie(name)
  })
  .client((name: string, value?: string, expires?: number) => {
    if (value) Cookies.set(name, value, { expires: expiresDate(expires || 7) })
    else Cookies.remove(name)
  })

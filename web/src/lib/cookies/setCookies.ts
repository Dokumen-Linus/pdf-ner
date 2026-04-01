import { createClientOnlyFn } from "@tanstack/react-start"
import Cookies from "js-cookie"

export interface Cookie {
  name: string
  value?: string
  expires?: number // days, defaults to 7
}

export const setCookies = createClientOnlyFn((cookies: Cookie[]) => {
  cookies.forEach(({ name, value, expires }) => {
    const d = new Date()
    d.setDate(d.getDate() + (expires || 7))
    if (value) Cookies.set(name, value, { expires: d })
    else Cookies.remove(name)
  })
})

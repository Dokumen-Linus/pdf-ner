import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ChevronDownIcon,
  CreditCardIcon,
  FolderOpenIcon,
  Languages,
  LogOutIcon,
  Menu,
  UserIcon,
  X,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { getUserByAuthUserId } from "@/db-fns/web/users"
import { m } from "@/integrations/paraglide/messages.js"
import { getLocale, locales, setLocale } from "@/integrations/paraglide/runtime"
import { authClient } from "@/lib/auth-client"
import logoUrl from "@/logo.svg"

import "./header.css"

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const [headerIdentity, setHeaderIdentity] = useState("")
  const currentLocale = getLocale()

  const handleLanguageChange = (newLocale: string) => {
    setLocale(newLocale as (typeof locales)[number])
  }

  useEffect(() => {
    let cancelled = false
    async function loadHeaderIdentity() {
      if (!session?.user?.id) {
        setHeaderIdentity("")
        return
      }
      try {
        const user = await getUserByAuthUserId({ data: { authUserId: session.user.id } })
        if (!cancelled) {
          setHeaderIdentity(user.displayName?.trim() || session.user.name || session.user.email)
        }
      } catch {
        if (!cancelled) {
          setHeaderIdentity(session.user.name || session.user.email)
        }
      }
    }
    void loadHeaderIdentity()
    return () => {
      cancelled = true
    }
  }, [session?.user?.email, session?.user?.id, session?.user?.name])

  return (
    <>
      <header className="site-header">
        <div>
          {/* Logo (Left) */}
          <Link to="/" className="logo">
            <img src={logoUrl} alt={m.common_brand_name()} />
            <span>
              {m.common_brand_primary()}
              <span>{m.common_brand_accent()}</span>
            </span>
          </Link>

          {/* Desktop Nav (Center) */}
          <nav>
            <Link to="/" activeProps={{ className: "active" }}>
              {m.nav_home()}
            </Link>
            <Link to="/demo" activeProps={{ className: "active" }}>
              {m.nav_demo()}
            </Link>
            <Link to="/pricing" activeProps={{ className: "active" }}>
              {m.nav_pricing()}
            </Link>
            <Link to="/platform" activeProps={{ className: "active" }}>
              {m.nav_platform()}
            </Link>
            <Link to="/about" activeProps={{ className: "active" }}>
              {m.nav_about()}
            </Link>
            <Link to="/contact" activeProps={{ className: "active" }}>
              {m.nav_contact()}
            </Link>
          </nav>

          {/* Desktop Auth (Right) */}
          <div className="actions">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button>
                    <span className="max-w-40 truncate">
                      {headerIdentity || session.user.name || session.user.email}
                    </span>
                    <ChevronDownIcon size={14} className="chevron shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/projects" className="flex cursor-pointer items-center gap-2">
                      <FolderOpenIcon size={14} />
                      {m.nav_projects()}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex cursor-pointer items-center gap-2">
                      <UserIcon size={14} />
                      {m.nav_profile()}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/billing" className="flex cursor-pointer items-center gap-2">
                      <CreditCardIcon size={14} />
                      {m.nav_billing()}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/signout" className="muted-link flex cursor-pointer items-center gap-2">
                      <LogOutIcon size={14} />
                      {m.nav_signout()}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/signin">
                  {m.nav_signin()}
                </Link>
                <Link to="/signup">
                  {m.nav_signup()}
                </Link>
              </>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button className="icon-only ml-1">
                  <Languages size={18} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="popover-content">
                {locales.map((tag: string) => (
                  <button
                    key={tag}
                    onClick={() => handleLanguageChange(tag)}
                    className={tag === currentLocale ? "active" : ""}
                  >
                    {tag}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="mobile-menu"
            aria-label={m.common_aria_menu()}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <div
        className={`mobile-overlay ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setIsOpen(false)}
      />
      <aside className={`mobile-drawer ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="drawer-header">
          <Popover>
            <PopoverTrigger asChild>
              <button>
                <Languages size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="popover-content">
              {locales.map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => handleLanguageChange(tag)}
                  className={tag === currentLocale ? "active" : ""}
                >
                  {tag}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setIsOpen(false)}
            aria-label={m.common_aria_close()}
          >
            <X size={20} />
          </button>
        </div>

        <nav>
          <Link to="/" onClick={() => setIsOpen(false)}>
            {m.nav_home()}
          </Link>
          <Link to="/pricing" onClick={() => setIsOpen(false)}>
            {m.nav_pricing()}
          </Link>
          <Link to="/platform" onClick={() => setIsOpen(false)}>
            {m.nav_platform()}
          </Link>
          <Link to="/about" onClick={() => setIsOpen(false)}>
            {m.nav_about()}
          </Link>
          <Link to="/contact" onClick={() => setIsOpen(false)}>
            {m.nav_contact()}
          </Link>
          {session ? (
            <>
              <div className="account">
                <p>{m.nav_account()}</p>
                <Link to="/projects" onClick={() => setIsOpen(false)}>
                  <FolderOpenIcon size={16} />
                  {m.nav_projects()}
                </Link>
                <Link to="/profile" onClick={() => setIsOpen(false)}>
                  <UserIcon size={16} />
                  {m.nav_profile()}
                </Link>
                <Link to="/billing" onClick={() => setIsOpen(false)}>
                  <CreditCardIcon size={16} />
                  {m.nav_billing()}
                </Link>
                <Link to="/signout" onClick={() => setIsOpen(false)} className="muted">
                  <LogOutIcon size={16} />
                  {m.nav_signout()}
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link to="/signin" onClick={() => setIsOpen(false)} className="mt-4">
                {m.nav_signin()}
              </Link>
              <Link to="/signup" onClick={() => setIsOpen(false)} className="mt-2">
                {m.nav_signup()}
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}


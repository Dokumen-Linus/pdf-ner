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
} from "@/components/icons"
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
        <div className="site-header-inner">
          {/* Logo (Left) */}
          <Link to="/" className="site-logo-link">
            <img src={logoUrl} className="site-logo-img" alt={m.common_brand_name()} />
            <span className="site-wordmark">
              {m.common_brand_primary()}
              <span className="site-wordmark-accent">{m.common_brand_accent()}</span>
            </span>
          </Link>

          {/* Desktop Nav (Center) */}
          <nav className="site-nav">
            <Link
              to="/"
              className="site-nav-link"
              activeProps={{ className: "site-nav-link-active" }}
            >
              {m.nav_home()}
            </Link>
            <Link
              to="/demo"
              className="site-nav-link"
              activeProps={{ className: "site-nav-link-active" }}
            >
              {m.nav_demo()}
            </Link>
            <Link
              to="/pricing"
              className="site-nav-link"
              activeProps={{ className: "site-nav-link-active" }}
            >
              {m.nav_pricing()}
            </Link>
            <Link
              to="/platform"
              className="site-nav-link"
              activeProps={{ className: "site-nav-link-active" }}
            >
              {m.nav_platform()}
            </Link>
            <Link
              to="/about"
              className="site-nav-link"
              activeProps={{ className: "site-nav-link-active" }}
            >
              {m.nav_about()}
            </Link>
            <Link
              to="/contact"
              className="site-nav-link"
              activeProps={{ className: "site-nav-link-active" }}
            >
              {m.nav_contact()}
            </Link>
          </nav>

          {/* Desktop Auth (Right) */}
          <div className="site-nav-actions">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="site-account-button">
                    <span className="max-w-40 truncate">
                      {headerIdentity || session.user.name || session.user.email}
                    </span>
                    <ChevronDownIcon size={14} className="site-account-chevron shrink-0" />
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
                    <Link
                      to="/signout"
                      className="site-muted-link flex cursor-pointer items-center gap-2"
                    >
                      <LogOutIcon size={14} />
                      {m.nav_signout()}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/signin" className="site-nav-link">
                  {m.nav_signin()}
                </Link>
                <Link to="/signup" className="site-nav-link">
                  {m.nav_signup()}
                </Link>
              </>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button className="site-icon-button ml-1">
                  <Languages size={18} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="site-popover-content">
                {locales.map((tag: string) => (
                  <button
                    key={tag}
                    onClick={() => handleLanguageChange(tag)}
                    className={`site-locale-option ${
                      tag === currentLocale ? "site-locale-option-active" : ""
                    }`}
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
            className="site-mobile-menu-button"
            aria-label={m.common_aria_menu()}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <div
        className={`site-mobile-overlay ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setIsOpen(false)}
      />
      <aside className={`site-mobile-drawer ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="site-mobile-drawer-header">
          <Popover>
            <PopoverTrigger asChild>
              <button className="site-icon-button">
                <Languages size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="site-popover-content">
              {locales.map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => handleLanguageChange(tag)}
                  className={`site-locale-option ${
                    tag === currentLocale ? "site-locale-option-active" : ""
                  }`}
                >
                  {tag}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setIsOpen(false)}
            className="site-icon-button"
            aria-label={m.common_aria_close()}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="site-mobile-nav">
          <Link to="/" onClick={() => setIsOpen(false)} className="site-mobile-link">
            {m.nav_home()}
          </Link>
          <Link to="/pricing" onClick={() => setIsOpen(false)} className="site-mobile-link">
            {m.nav_pricing()}
          </Link>
          <Link to="/platform" onClick={() => setIsOpen(false)} className="site-mobile-link">
            {m.nav_platform()}
          </Link>
          <Link to="/about" onClick={() => setIsOpen(false)} className="site-mobile-link">
            {m.nav_about()}
          </Link>
          <Link to="/contact" onClick={() => setIsOpen(false)} className="site-mobile-link">
            {m.nav_contact()}
          </Link>
          {session ? (
            <>
              <div className="site-mobile-account">
                <p className="site-mobile-account-label">{m.nav_account()}</p>
                <Link
                  to="/projects"
                  onClick={() => setIsOpen(false)}
                  className="site-mobile-account-link"
                >
                  <FolderOpenIcon size={16} />
                  {m.nav_projects()}
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="site-mobile-account-link"
                >
                  <UserIcon size={16} />
                  {m.nav_profile()}
                </Link>
                <Link
                  to="/billing"
                  onClick={() => setIsOpen(false)}
                  className="site-mobile-account-link"
                >
                  <CreditCardIcon size={16} />
                  {m.nav_billing()}
                </Link>
                <Link
                  to="/signout"
                  onClick={() => setIsOpen(false)}
                  className="site-mobile-muted-link"
                >
                  <LogOutIcon size={16} />
                  {m.nav_signout()}
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link to="/signin" onClick={() => setIsOpen(false)} className="site-mobile-link mt-4">
                {m.nav_signin()}
              </Link>
              <Link to="/signup" onClick={() => setIsOpen(false)} className="site-mobile-link mt-2">
                {m.nav_signup()}
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}

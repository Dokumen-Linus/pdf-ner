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
      <header className="sticky top-0 z-40 w-full transition-colors duration-300 bg-white border-b border-[#EEEEEE]">
        <div className="mx-auto flex h-14 max-w-345.75 items-center justify-between px-6">
          {/* Logo (Left) */}
          <Link to="/" className="flex shrink-0 items-center gap-3 group">
            <img
              src={logoUrl}
              className="h-6 w-auto object-contain transition-transform"
              alt="Dokumen AI"
            />
            <span className="text-[17px] font-bold tracking-[0.2em] uppercase text-[#171A20]">
              Dokumen<span className="text-[#3E6AE1]">AI</span>
            </span>
          </Link>

          {/* Desktop Nav (Center) */}
          <nav className="hidden md:flex flex-1 items-center justify-center gap-2">
            <Link
              to="/"
              className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
              activeProps={{
                className:
                  "rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] bg-[#F4F4F4]",
              }}
            >
              {m.nav_home()}
            </Link>
            <Link
              to="/demo"
              className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
              activeProps={{
                className:
                  "rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] bg-[#F4F4F4]",
              }}
            >
              {m.nav_demo()}
            </Link>
            <Link
              to="/pricing"
              className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
              activeProps={{
                className:
                  "rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] bg-[#F4F4F4]",
              }}
            >
              Pricing
            </Link>
            <Link
              to="/about"
              className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
              activeProps={{
                className:
                  "rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] bg-[#F4F4F4]",
              }}
            >
              About
            </Link>
            <Link
              to="/contact"
              className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
              activeProps={{
                className:
                  "rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] bg-[#F4F4F4]",
              }}
            >
              Contact
            </Link>
          </nav>

          {/* Desktop Auth (Right) */}
          <div className="hidden md:flex shrink-0 items-center justify-end gap-2">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]">
                    <span className="max-w-40 truncate">
                      {headerIdentity || session.user.name || session.user.email}
                    </span>
                    <ChevronDownIcon size={14} className="shrink-0 text-[#5C5E62]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/projects" className="flex items-center gap-2 cursor-pointer">
                      <FolderOpenIcon size={14} />
                      Projects
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <UserIcon size={14} />
                      {m.nav_profile()}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/billing" className="flex items-center gap-2 cursor-pointer">
                      <CreditCardIcon size={14} />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/signout"
                      className="flex items-center gap-2 cursor-pointer text-[#5C5E62]"
                    >
                      <LogOutIcon size={14} />
                      {m.nav_signout()}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
                >
                  {m.nav_signin()}
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
                >
                  {m.nav_signup()}
                </Link>
              </>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button className="rounded-lg p-2 text-[#171A20] hover:bg-[#F4F4F4] transition-colors ml-1">
                  <Languages size={18} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="bg-white rounded-lg shadow-lg border border-[#EEEEEE] w-auto min-w-20 p-1"
              >
                {locales.map((tag: string) => (
                  <button
                    key={tag}
                    onClick={() => handleLanguageChange(tag)}
                    className={`w-full text-left uppercase px-3 py-1.5 text-sm rounded-md transition-colors ${
                      tag === currentLocale
                        ? "bg-[#F4F4F4] font-semibold text-[#171A20]"
                        : "text-[#5C5E62] hover:bg-[#F4F4F4] hover:text-[#171A20]"
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
            className="md:hidden rounded-lg p-1.5 text-[#171A20] hover:bg-[#F4F4F4] transition-colors"
            aria-label={m.common_aria_menu()}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsOpen(false)}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.05)] transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between p-4">
          <Popover>
            <PopoverTrigger asChild>
              <button className="rounded-lg p-2 text-[#171A20] hover:bg-[#F4F4F4] transition-colors">
                <Languages size={18} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              className="bg-white rounded-lg shadow-lg border border-[#EEEEEE] w-auto min-w-20 p-1"
            >
              {locales.map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => handleLanguageChange(tag)}
                  className={`w-full text-left uppercase px-3 py-1.5 text-sm rounded-md transition-colors ${
                    tag === currentLocale
                      ? "bg-[#F4F4F4] font-semibold text-[#171A20]"
                      : "text-[#5C5E62] hover:bg-[#F4F4F4] hover:text-[#171A20]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-[#171A20] hover:bg-[#F4F4F4] transition-colors"
            aria-label={m.common_aria_close()}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 pb-6 pt-2 flex flex-col gap-4">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
          >
            {m.nav_home()}
          </Link>
          <Link
            to="/pricing"
            onClick={() => setIsOpen(false)}
            className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
          >
            Pricing
          </Link>
          <Link
            to="/about"
            onClick={() => setIsOpen(false)}
            className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
          >
            About
          </Link>
          <Link
            to="/contact"
            onClick={() => setIsOpen(false)}
            className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
          >
            Contact
          </Link>
          {session ? (
            <>
              <div className="mt-4 border-t border-[#EEEEEE] pt-4 flex flex-col gap-4">
                <p className="text-[12px] font-medium uppercase tracking-wide text-[#8E8E8E]">
                  Account
                </p>
                <Link
                  to="/projects"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
                >
                  <FolderOpenIcon size={16} />
                  Projects
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
                >
                  <UserIcon size={16} />
                  {m.nav_profile()}
                </Link>
                <Link
                  to="/billing"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
                >
                  <CreditCardIcon size={16} />
                  Billing
                </Link>
                <Link
                  to="/signout"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-[17px] font-medium text-[#5C5E62] hover:text-[#171A20] transition-colors mt-2"
                >
                  <LogOutIcon size={16} />
                  {m.nav_signout()}
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                onClick={() => setIsOpen(false)}
                className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors mt-4"
              >
                {m.nav_signin()}
              </Link>
              <Link
                to="/signup"
                onClick={() => setIsOpen(false)}
                className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors mt-2"
              >
                {m.nav_signup()}
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}

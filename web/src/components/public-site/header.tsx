import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Menu, X } from "lucide-react"
import { getUserByEmail } from "@/db-fns/web/users"
import { authClient } from "@/lib/auth-client"
import logoUrl from "@/logo.svg"

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const [headerIdentity, setHeaderIdentity] = useState("")

  useEffect(() => {
    let cancelled = false
    async function loadHeaderIdentity() {
      if (!session?.user?.email) {
        setHeaderIdentity("")
        return
      }
      try {
        const user = await getUserByEmail({ data: { email: session.user.email } })
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
  }, [session?.user?.email, session?.user?.name])

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
              Home
            </Link>
            <Link
              to="/demo"
              className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
              activeProps={{
                className:
                  "rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] bg-[#F4F4F4]",
              }}
            >
              Demo
            </Link>
          </nav>

          {/* Desktop Auth (Right) */}
          <div className="hidden md:flex shrink-0 items-center justify-end gap-2">
            {session ? (
              <>
                <Link
                  to="/profile"
                  className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
                >
                  {headerIdentity || session.user.name || session.user.email}
                </Link>
                <Link
                  to="/signout"
                  className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
                >
                  Sign Out
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg px-4 py-1.5 text-[14px] font-medium text-[#171A20] transition-colors hover:bg-[#F4F4F4]"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="md:hidden rounded-lg p-1.5 text-[#171A20] hover:bg-[#F4F4F4] transition-colors"
            aria-label="Menu"
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
        <div className="flex items-center justify-end p-4">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-[#171A20] hover:bg-[#F4F4F4] transition-colors"
            aria-label="Close"
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
            Home
          </Link>
          <Link
            to="/demo"
            onClick={() => setIsOpen(false)}
            className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors"
          >
            Demo
          </Link>
          {session ? (
            <>
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors mt-4"
              >
                Profile
              </Link>
              <Link
                to="/signout"
                onClick={() => setIsOpen(false)}
                className="text-[17px] font-medium text-[#5C5E62] hover:text-[#171A20] transition-colors mt-2"
              >
                Sign Out
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                onClick={() => setIsOpen(false)}
                className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors mt-4"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={() => setIsOpen(false)}
                className="text-[17px] font-medium text-[#171A20] hover:text-[#393C41] transition-colors mt-2"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}

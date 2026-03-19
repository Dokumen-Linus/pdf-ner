import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { FileText, Home, LogIn, LogOut, Menu, Sparkles, UserPlus, X } from "lucide-react"
import { getUserByEmail } from "@/db-fns/web/users"
import { authClient } from "@/lib/auth-client"

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
      <header className="sticky top-0 z-40 transition-all duration-300 bg-slate-900/95 backdrop-blur-md shadow-lg border-b border-slate-700/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 transition-transform group-hover:scale-105">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Dokumen<span className="text-cyan-400">AI</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              activeProps={{
                className: "px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg",
              }}
            >
              Home
            </Link>
            <Link
              to="/demo"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              activeProps={{
                className: "px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg",
              }}
            >
              Demo
            </Link>
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <>
                <Link
                  to="/profile"
                  className="text-sm text-slate-300 hover:text-white transition-colors"
                >
                  {headerIdentity || session.user.name || session.user.email}
                </Link>
                <Link
                  to="/signout"
                  className="flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="flex items-center gap-2 text-sm bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40"
                >
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-80 bg-slate-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-cyan-500 to-blue-600">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">
              Dokumen<span className="text-cyan-400">AI</span>
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors mb-1"
            activeProps={{
              className:
                "flex items-center gap-3 p-3 rounded-lg bg-cyan-600/20 text-cyan-400 transition-colors mb-1",
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          <Link
            to="/demo"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors mb-1"
            activeProps={{
              className:
                "flex items-center gap-3 p-3 rounded-lg bg-cyan-600/20 text-cyan-400 transition-colors mb-1",
            }}
          >
            <Sparkles size={20} />
            <span className="font-medium">PDF Labeling Demo</span>
          </Link>

          <div className="my-4 border-t border-slate-700" />

          {session ? (
            <>
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors mb-1"
              >
                <LogOut size={20} />
                <span className="font-medium">
                  {headerIdentity || session.user.name || "Profile"}
                </span>
              </Link>
              <Link
                to="/signout"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-red-400"
              >
                <LogOut size={20} />
                <span className="font-medium">Sign Out</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors mb-1"
              >
                <LogIn size={20} />
                <span className="font-medium">Sign In</span>
              </Link>
              <Link
                to="/signup"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg bg-linear-to-r from-cyan-500 to-blue-600 text-white transition-colors"
              >
                <UserPlus size={20} />
                <span className="font-medium">Sign Up</span>
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}

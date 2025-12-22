import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { Home, Menu, SquareFunction, X } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = authClient.useSession()

  return (
    <>
      <header className="p-4 flex items-center bg-gray-800 text-white shadow-lg justify-between">
        <div className="flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <h1 className="ml-4 text-xl font-semibold">
            <Link to="/">
              <img src="/tanstack-word-logo-white.svg" alt="TanStack Logo" className="h-10" />
            </Link>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300 hidden sm:inline-block">
                {session.user.email}
              </span>
              <Link
                to="/signout"
                className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md transition-colors"
              >
                Sign Out
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/signin" className="text-sm hover:text-cyan-400 transition-colors">
                Sign In
              </Link>
              <Link
                to="/signup"
                className="text-sm bg-cyan-600 hover:bg-cyan-700 px-3 py-2 rounded-md transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                "flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2",
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          <Link
            to="/demo"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                "flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2",
            }}
          >
            <SquareFunction size={20} />
            <span className="font-medium">PDF Labeling Demo</span>
          </Link>
        </nav>
      </aside>
    </>
  )
}

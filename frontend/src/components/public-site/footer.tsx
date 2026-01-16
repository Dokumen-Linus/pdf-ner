import { Link } from "@tanstack/react-router"

export default function Footer() {
  return (
    <>
      <footer className="p-4 flex items-center bg-stone-700 text-white shadow-lg justify-between">
        <Link
          to="/demo"
          className="text-sm bg-stone-600 hover:bg-stone-500 px-3 py-2 rounded-md transition-colors"
        >
          Demo
        </Link>
      </footer>
    </>
  )
}

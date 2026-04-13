import { Link } from "@tanstack/react-router"
import { m } from "../../integrations/paraglide/messages.js"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#171A20] w-full py-16">
      <div className="mx-auto flex max-w-345.75 flex-col items-center px-6">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 mb-4">
          <li>
            <span className="text-[12px] font-medium text-[#D0D1D2]">
              {m.footer_brand()} &copy; {currentYear}
            </span>
          </li>
          <li>
            <Link
              to="/demo"
              className="text-[12px] font-medium text-[#D0D1D2] hover:text-[#FFFFFF] transition-colors"
            >
              {m.footer_demo()}
            </Link>
          </li>
          <li>
            <Link
              to="/signin"
              className="text-[12px] font-medium text-[#D0D1D2] hover:text-[#FFFFFF] transition-colors"
            >
              {m.footer_signin()}
            </Link>
          </li>
          <li>
            <Link
              to="/signup"
              className="text-[12px] font-medium text-[#D0D1D2] hover:text-[#FFFFFF] transition-colors"
            >
              {m.footer_signup()}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}

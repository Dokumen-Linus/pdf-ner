import { Link } from "@tanstack/react-router"

import { m } from "../../integrations/paraglide/messages.js"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full bg-[#171A20] py-16">
      <div className="mx-auto flex max-w-345.75 flex-col items-center px-6">
        <ul className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <li>
            <span className="text-[12px] font-medium text-[#D0D1D2]">
              {m.footer_brand()} &copy; {currentYear}
            </span>
          </li>
          <li>
            <Link
              to="/demo"
              className="text-[12px] font-medium text-[#D0D1D2] transition-colors hover:text-[#FFFFFF]"
            >
              {m.footer_demo()}
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              className="text-[12px] font-medium text-[#D0D1D2] transition-colors hover:text-[#FFFFFF]"
            >
              About
            </Link>
          </li>
          <li>
            <Link
              to="/signin"
              className="text-[12px] font-medium text-[#D0D1D2] transition-colors hover:text-[#FFFFFF]"
            >
              {m.footer_signin()}
            </Link>
          </li>
          <li>
            <Link
              to="/signup"
              className="text-[12px] font-medium text-[#D0D1D2] transition-colors hover:text-[#FFFFFF]"
            >
              {m.footer_signup()}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}

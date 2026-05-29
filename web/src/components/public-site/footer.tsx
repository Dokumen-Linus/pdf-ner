import { Link } from "@tanstack/react-router"

import { m } from "../../integrations/paraglide/messages.js"

import "./footer.css"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer>
      <div>
        <ul>
          <li>
            <span>
              {m.footer_copyright({ year: String(currentYear) })}
            </span>
          </li>
          <li>
            <Link to="/demo">
              {m.footer_demo()}
            </Link>
          </li>
          <li>
            <Link to="/about">
              {m.footer_about()}
            </Link>
          </li>
          <li>
            <Link to="/platform">
              {m.footer_platform()}
            </Link>
          </li>
          <li>
            <Link to="/signin">
              {m.footer_signin()}
            </Link>
          </li>
          <li>
            <Link to="/signup">
              {m.footer_signup()}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}


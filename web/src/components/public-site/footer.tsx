import { Link } from "@tanstack/react-router"

import { m } from "../../integrations/paraglide/messages.js"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <ul className="site-footer-list">
          <li>
            <span className="site-footer-text">
              {m.footer_copyright({ year: String(currentYear) })}
            </span>
          </li>
          <li>
            <Link to="/demo" className="site-footer-text">
              {m.footer_demo()}
            </Link>
          </li>
          <li>
            <Link to="/about" className="site-footer-text">
              {m.footer_about()}
            </Link>
          </li>
          <li>
            <Link to="/signin" className="site-footer-text">
              {m.footer_signin()}
            </Link>
          </li>
          <li>
            <Link to="/signup" className="site-footer-text">
              {m.footer_signup()}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}

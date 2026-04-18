import { createFileRoute, Outlet } from "@tanstack/react-router"

import Chatbot from "@/components/public-site/chatbot"
import Footer from "@/components/public-site/footer"
import Header from "@/components/public-site/header"

export const Route = createFileRoute("/_public")({
  component: () => (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Chatbot />
    </>
  ),
})

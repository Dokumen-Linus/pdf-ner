import { createFileRoute, Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import { Tweet } from "react-tweet"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/shadcn-ui/carousel"
import { m } from "@/integrations/paraglide/messages.js"

export const Route = createFileRoute("/_public/")({ component: App })

// Cursor SVG for the No-Code interface animation
const CursorIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-sm"
  >
    <path
      d="M5.5 3.21V20.8C5.5 21.6 6.4 22 7.03 21.5L11.4 17.5L15.3 22.8C15.7 23.3 16.3 23.5 16.9 23.1L18.8 21.8C19.3 21.4 19.5 20.8 19.1 20.3L15.3 15H20.6C21.4 15 21.8 14 21.3 13.4L6.93 2.53C6.35 2.08 5.5 2.5 5.5 3.21Z"
      fill="#171A20"
      stroke="white"
      strokeWidth="1.5"
    />
  </svg>
)

function App() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section - 100vh */}
      <section className="relative mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-345.75 flex-col items-center justify-center overflow-hidden px-6 md:flex-row">
        {/* Left Side: Headline & Copy */}
        <div className="z-10 flex w-full flex-col justify-center py-12 md:w-1/2">
          <h1 className="mb-6 max-w-lg text-[40px] leading-[1.2] font-medium tracking-normal text-[#171A20]">
            {m.landing_hero_title()}
          </h1>
          <p className="mb-10 max-w-md text-[14px] leading-[1.43] font-normal text-[#393C41]">
            {m.landing_hero_description()}
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              to="/signup"
              className="group flex min-h-10 w-full items-center justify-center rounded-lg border-[3px] border-transparent bg-[#3E6AE1] px-4 text-[14px] font-medium text-white transition-all duration-330 hover:bg-[#2e52b5] focus:border-[#3E6AE1] focus:shadow-[inset_0_0_0_2px_white] sm:w-50"
            >
              {m.landing_hero_cta_signup()}
            </Link>
            <Link
              to="/demo"
              className="group flex min-h-10 w-full items-center justify-center rounded-lg border-[3px] border-transparent bg-[#F4F4F4] px-4 text-[14px] font-medium text-[#393C41] transition-all duration-330 hover:bg-[#EAEAEA] sm:w-50"
            >
              {m.landing_hero_cta_demo()}
            </Link>
          </div>
        </div>

        {/* Right Side: UI Animation */}
        <div className="relative mt-12 flex h-100 w-full items-center justify-center p-8 md:mt-0 md:w-1/2">
          {/* Animated Document Simulation */}
          <div className="relative mx-auto aspect-8.5/11 w-full max-w-[320px] overflow-hidden rounded-lg border border-[#EEEEEE] bg-white p-8">
            <div className="flex flex-col gap-4">
              <div className="h-4 w-1/3 bg-[#D0D1D2]" />
              <div className="h-2 w-full bg-[#EEEEEE]" />
              <div className="h-2 w-5/6 bg-[#EEEEEE]" />
              <div className="h-2 w-full bg-[#EEEEEE]" />
              <div className="h-2 w-4/5 bg-[#EEEEEE]" />
              <div className="h-2 w-full bg-[#EEEEEE]" />
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <div className="h-4 w-1/4 bg-[#D0D1D2]" />
              <div className="h-2 w-full bg-[#EEEEEE]" />

              {/* Highlight Target */}
              <div className="relative h-6 w-11/12">
                <div className="absolute inset-0 flex flex-col gap-2">
                  <div className="h-2 w-full bg-[#EEEEEE]" />
                  <div className="h-2 w-3/4 bg-[#EEEEEE]" />
                </div>

                {/* The Scanning Highlight Box */}
                <motion.div
                  className="absolute -top-1 -bottom-1 -left-1 rounded-[2px] border border-[#3E6AE1] bg-[#3E6AE1]/20"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{
                    width: ["0%", "100%", "100%", "0%"],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                />
              </div>

              <div className="h-2 w-full bg-[#EEEEEE]" />
            </div>

            {/* Structured Output Extraction Sim */}
            <motion.div
              className="absolute top-[50%] right-4 z-20 rounded-lg border border-[#EEEEEE] bg-white p-3 font-mono text-[10px] text-[#171A20] shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: [20, 0, 0, 20], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 3,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              &#123;
              <br />
              &nbsp;&nbsp;&quot;entity&quot;: &quot;invoice_total&quot;,
              <br />
              &nbsp;&nbsp;&quot;value&quot;: &quot;$4,291.00&quot;,
              <br />
              &nbsp;&nbsp;&quot;confidence&quot;: 0.98
              <br />
              &#125;
            </motion.div>

            {/* Vertical scanning laser line */}
            <motion.div
              className="absolute right-0 left-0 z-10 h-0.5 bg-[#3E6AE1]/50 shadow-[0_0_8px_#3E6AE1]"
              initial={{ top: "10%" }}
              animate={{ top: ["10%", "90%", "10%"] }}
              transition={{
                duration: 4,
                ease: "linear",
                repeat: Infinity,
              }}
            />
          </div>
        </div>
      </section>

      {/* Feature 1: No-Code Interface */}
      <section className="bg-[#F4F4F4] px-6 py-32">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-16 md:flex-row">
          <div className="w-full max-w-sm md:w-1/2">
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.landing_feature_nocode_title()}
            </h2>
            <p className="text-[16px] leading-[1.6] font-normal text-[#5C5E62]">
              {m.landing_feature_nocode_description()}
            </p>
          </div>
          <div className="relative flex h-75 w-full items-center justify-center md:w-1/2">
            {/* Animation 1: Drag & Annotate */}
            <div className="relative h-60 w-85 overflow-hidden rounded-xl border border-[#D0D1D2] bg-white p-8 shadow-sm">
              <div className="space-y-4">
                <div className="h-3 w-1/2 rounded-[2px] bg-[#EEEEEE]" />
                <div className="h-3 w-full rounded-[2px] bg-[#EEEEEE]" />
                <div className="h-3 w-5/6 rounded-[2px] bg-[#EEEEEE]" />
              </div>

              {/* Target Text block */}
              <div className="relative mt-8 w-4/5 pt-2">
                <div className="h-5 w-full rounded-[2px] bg-[#EEEEEE]" />

                {/* Animated bounding box matching drag */}
                <motion.div
                  className="absolute inset-0 mt-2 rounded-[2px] border-2 border-[#3E6AE1] bg-[#3E6AE1]/10"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{
                    duration: 1.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                />

                {/* Animated Label Popup */}
                <motion.div
                  className="absolute -top-6 left-0 rounded-[2px] bg-[#3E6AE1] px-2 py-0.5 text-[10px] font-medium text-white"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 1.2,
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 2.2,
                  }}
                >
                  {m.landing_feature_nocode_label_vendor()}
                </motion.div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="h-3 w-full rounded-[2px] bg-[#EEEEEE]" />
                <div className="h-3 w-2/3 rounded-[2px] bg-[#EEEEEE]" />
              </div>

              {/* Animated Cursor */}
              <motion.div
                className="pointer-events-none absolute z-20 drop-shadow-md"
                initial={{ x: 28, y: 92 }}
                animate={{ x: 260, y: 92 }}
                transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 2 }}
              >
                <CursorIcon />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Lightning Models */}
      <section className="bg-white px-6 py-32">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-16 md:flex-row-reverse">
          <div className="w-full max-w-sm md:w-1/2">
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.landing_feature_models_title()}
            </h2>
            <p className="text-[16px] leading-[1.6] font-normal text-[#5C5E62]">
              {m.landing_feature_models_description()}
            </p>
          </div>
          <div className="relative flex h-75 w-full items-center justify-center md:w-1/2">
            {/* Animation 2: Model Training */}
            <div className="relative flex h-60 w-85 items-center justify-between px-4">
              {/* Flowing Docs (Left -> Center) */}
              <div className="relative flex h-full w-16 flex-col items-center justify-center">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute flex h-14 w-10 flex-col gap-1 rounded-[2px] border-2 border-[#EEEEEE] bg-white p-1.5 shadow-sm"
                    initial={{ x: -60, y: (i - 2) * 20, opacity: 0, scale: 0.8 }}
                    animate={{ x: 80, y: 0, opacity: [0, 1, 0], scale: [0.8, 1, 0.6] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.6,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="h-1 w-full rounded-full bg-[#D0D1D2]" />
                    <div className="h-1 w-3/4 rounded-full bg-[#D0D1D2]" />
                    <div className="h-1 w-full rounded-full bg-[#D0D1D2]" />
                  </motion.div>
                ))}
              </div>

              {/* Model Core Engine (Center) */}
              <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-xl border border-[#393C41] bg-[#171A20] shadow-lg">
                {/* Rotating visual 1 */}
                <motion.div
                  className="absolute inset-0 m-2 rounded-xl border border-[#3E6AE1] opacity-50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, ease: "linear", repeat: Infinity }}
                />
                {/* Rotating visual 2 */}
                <motion.div
                  className="absolute inset-0 m-4 rounded-xl border border-dashed border-[#5C5E62]"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, ease: "linear", repeat: Infinity }}
                />
                {/* Center Dot */}
                <motion.div
                  className="h-3 w-3 rounded-full bg-[#3E6AE1] shadow-[0_0_12px_#3E6AE1]"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Flowing JSON Outputs (Center -> Right) */}
              <div className="relative flex h-full w-20 flex-col items-center justify-center">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute flex h-10 w-20 items-center justify-center rounded-lg border border-[#3E6AE1]/30 bg-[#3E6AE1]/5 font-mono text-[11px] text-[#3E6AE1] shadow-sm"
                    initial={{ x: -40, opacity: 0, scale: 0.6 }}
                    animate={{ x: 60, opacity: [0, 1, 0], scale: [0.6, 1, 0.9] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.6 + 1,
                      ease: "easeInOut",
                    }}
                  >
                    &#123;...&#125;
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Seamless Integration */}
      <section className="bg-[#F4F4F4] px-6 py-32">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-16 md:flex-row">
          <div className="w-full max-w-sm md:w-1/2">
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.landing_feature_integration_title()}
            </h2>
            <p className="text-[16px] leading-[1.6] font-normal text-[#5C5E62]">
              {m.landing_feature_integration_description()}
            </p>
          </div>
          <div className="relative flex h-75 w-full items-center justify-center md:w-1/2">
            {/* Animation 3: Integration Pipes */}
            <div className="relative flex h-65 w-85 items-center">
              {/* Source Node */}
              <div className="relative z-10 flex h-25 w-25 flex-col items-center justify-center rounded-xl border border-[#D0D1D2] bg-white shadow-sm">
                <span className="mb-1 text-[12px] font-semibold text-[#171A20]">
                  {m.landing_feature_integration_pipeline()}
                </span>
                <div className="rounded-[2px] border border-[#3E6AE1]/20 bg-[#3E6AE1]/10 px-2 py-0.5 font-mono text-[10px] text-[#3E6AE1]">
                  {m.landing_feature_integration_active()}
                </div>

                {/* Origin Pulse */}
                <motion.div
                  className="absolute top-1/2 -right-1 -mt-1 h-2 w-2 rounded-full bg-[#3E6AE1]"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>

              {/* Connection Trace Lines */}
              <div className="absolute left-25 flex h-40 w-25 items-center">
                {/* Middle Line */}
                <div className="h-0.5 w-full bg-[#EEEEEE]" />
                {/* Top Angled Line */}
                <div
                  className="absolute top-5 left-0 h-0.5 w-12.5 bg-[#EEEEEE]"
                  style={{ transformOrigin: "0 50%", rotate: "-40deg" }}
                />
                <div className="absolute top-0 right-0 h-0.5 w-15.5 bg-[#EEEEEE]" />
                {/* Bottom Angled Line */}
                <div
                  className="absolute bottom-5 left-0 h-0.5 w-12.5 bg-[#EEEEEE]"
                  style={{ transformOrigin: "0 50%", rotate: "40deg" }}
                />
                <div className="absolute right-0 bottom-0 h-0.5 w-15.5 bg-[#EEEEEE]" />

                {/* Flowing Data Pellets */}
                <motion.div
                  className="absolute top-[50%] -mt-0.75 h-1.5 w-1.5 rounded-full bg-[#3E6AE1]"
                  initial={{ left: 0 }}
                  animate={{ left: "100%" }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute -top-0.75 h-1.5 w-1.5 rounded-full bg-[#3E6AE1]"
                  initial={{ left: 0, top: "50%" }}
                  animate={{ left: ["0%", "30%", "100%"], top: ["50%", "0%", "0%"] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.3, ease: "linear" }}
                />
                <motion.div
                  className="absolute -bottom-0.75 h-1.5 w-1.5 rounded-full bg-[#3E6AE1]"
                  initial={{ left: 0, top: "50%" }}
                  animate={{ left: ["0%", "30%", "100%"], top: ["50%", "100%", "100%"] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.6, ease: "linear" }}
                />
              </div>

              {/* Destinations */}
              <div className="absolute right-0 z-10 flex h-47.5 w-32.5 flex-col justify-between py-1">
                <div className="ml-auto flex h-12 w-25 items-center justify-center rounded-xl border border-[#D0D1D2] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-[12px] font-medium text-[#5C5E62]">
                    {m.landing_feature_integration_rest_api()}
                  </span>
                </div>
                {/* Mid Dest / Highlighted */}
                <motion.div
                  className="relative ml-auto flex h-14.5 w-30 flex-col items-center justify-center rounded-xl border-2 border-[#3E6AE1] bg-white shadow-[0_4px_16px_rgba(62,106,225,0.15)]"
                  animate={{ y: [-2, 2, -2] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="text-[13px] font-semibold text-[#171A20]">
                    {m.landing_feature_integration_postgresql()}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] text-[#3E6AE1]">
                    {m.landing_feature_integration_synced_ago({ time: "1s" })}
                  </span>
                </motion.div>
                {/* Bottom Dest */}
                <div className="ml-auto flex h-12 w-25 items-center justify-center rounded-xl border border-[#D0D1D2] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <span className="text-[12px] font-medium text-[#5C5E62]">
                    {m.landing_feature_integration_webhook()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tweets Section */}
      <section className="bg-white px-6 py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-[32px] font-medium text-[#171A20]">
              {m.landing_tweets_title()}
            </h2>
            <p className="text-[16px] font-normal text-[#5C5E62]">
              {m.landing_tweets_description()}
            </p>
          </div>

          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="relative w-full"
          >
            <CarouselContent className="-ml-4">
              {[
                "1628832338187636740",
                "2042723870055239708",
                "1617979122625712128",
                "2043057246897148374",
              ].map((id) => (
                <CarouselItem key={id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                  <Tweet id={id} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden md:block">
              <CarouselPrevious className="-left-12 bg-white/50 hover:bg-white" />
              <CarouselNext className="-right-12 bg-white/50 hover:bg-white" />
            </div>
          </Carousel>
        </div>
      </section>

      {/* Demo Link Section */}
      <section className="flex min-h-[50vh] flex-col items-center justify-center bg-[#F4F4F4] px-6 py-40 text-center">
        <h2 className="mb-6 text-[40px] font-medium text-[#171A20]">{m.landing_demo_title()}</h2>
        <p className="mb-10 max-w-md text-[16px] font-normal text-[#393C41]">
          {m.landing_demo_description()}
        </p>
        <Link
          to="/demo"
          className="flex items-center justify-center rounded-lg bg-[#3E6AE1] px-16 py-4 text-[15px] font-medium text-white shadow-[0_4px_14px_0_rgba(62,106,225,0.39)] transition-all duration-330 hover:-translate-y-0.5 hover:bg-[#2e52b5] hover:shadow-[0_6px_20px_rgba(62,106,225,0.23)]"
        >
          {m.landing_demo_cta()}
        </Link>
      </section>
    </div>
  )
}

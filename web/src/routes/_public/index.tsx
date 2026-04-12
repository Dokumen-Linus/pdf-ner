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
import { m } from "@/paraglide/messages.js"

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

export default function App() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Hero Section - 100vh */}
      <section className="relative flex min-h-[calc(100vh-56px)] w-full flex-col px-6 md:flex-row items-center justify-center max-w-345.75 mx-auto overflow-hidden">
        {/* Left Side: Headline & Copy */}
        <div className="w-full md:w-1/2 flex flex-col justify-center z-10 py-12">
          <h1 className="text-[40px] font-medium leading-[1.2] text-[#171A20] tracking-normal mb-6 max-w-lg">
            {m.landing_hero_title()}
          </h1>
          <p className="text-[14px] font-normal leading-[1.43] text-[#393C41] mb-10 max-w-md">
            {m.landing_hero_description()}
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              to="/signup"
              className="group flex items-center justify-center min-h-10 w-full sm:w-50 rounded-lg bg-[#3E6AE1] px-4 text-[14px] font-medium text-white border-[3px] border-transparent transition-all duration-330 hover:bg-[#2e52b5] focus:border-[#3E6AE1] focus:shadow-[inset_0_0_0_2px_white]"
            >
              {m.landing_hero_cta_signup()}
            </Link>
            <Link
              to="/demo"
              className="group flex items-center justify-center min-h-10 w-full sm:w-50 rounded-lg bg-[#F4F4F4] px-4 text-[14px] font-medium text-[#393C41] border-[3px] border-transparent transition-all duration-330 hover:bg-[#EAEAEA]"
            >
              {m.landing_hero_cta_demo()}
            </Link>
          </div>
        </div>

        {/* Right Side: UI Animation */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-8 mt-12 md:mt-0 relative h-100">
          {/* Animated Document Simulation */}
          <div className="relative w-full max-w-[320px] aspect-8.5/11 bg-white border border-[#EEEEEE] mx-auto p-8 overflow-hidden rounded-lg">
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
              <div className="relative w-11/12 h-6">
                <div className="absolute inset-0 flex flex-col gap-2">
                  <div className="h-2 w-full bg-[#EEEEEE]" />
                  <div className="h-2 w-3/4 bg-[#EEEEEE]" />
                </div>

                {/* The Scanning Highlight Box */}
                <motion.div
                  className="absolute -left-1 -top-1 -bottom-1 rounded-[2px] bg-[#3E6AE1]/20 border border-[#3E6AE1]"
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
              className="absolute right-4 top-[50%] bg-white border border-[#EEEEEE] p-3 text-[10px] text-[#171A20] font-mono shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-20 rounded-lg"
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
              className="absolute left-0 right-0 h-0.5 bg-[#3E6AE1]/50 shadow-[0_0_8px_#3E6AE1] z-10"
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
      <section className="py-32 px-6 bg-[#F4F4F4]">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-16">
          <div className="w-full md:w-1/2 max-w-sm">
            <h2 className="text-[32px] font-medium text-[#171A20] mb-4">{m.landing_feature_nocode_title()}</h2>
            <p className="text-[16px] font-normal text-[#5C5E62] leading-[1.6]">
              {m.landing_feature_nocode_description()}
            </p>
          </div>
          <div className="w-full md:w-1/2 relative h-75 flex items-center justify-center">
            {/* Animation 1: Drag & Annotate */}
            <div className="relative w-85 h-60 bg-white border border-[#D0D1D2] p-8 shadow-sm overflow-hidden rounded-xl">
              <div className="space-y-4">
                <div className="h-3 w-1/2 bg-[#EEEEEE] rounded-[2px]" />
                <div className="h-3 w-full bg-[#EEEEEE] rounded-[2px]" />
                <div className="h-3 w-5/6 bg-[#EEEEEE] rounded-[2px]" />
              </div>

              {/* Target Text block */}
              <div className="mt-8 relative w-4/5 pt-2">
                <div className="h-5 w-full bg-[#EEEEEE] rounded-[2px]" />

                {/* Animated bounding box matching drag */}
                <motion.div
                  className="absolute inset-0 border-2 border-[#3E6AE1] bg-[#3E6AE1]/10 rounded-[2px] mt-2"
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
                  className="absolute -top-6 left-0 bg-[#3E6AE1] px-2 py-0.5 text-[10px] text-white font-medium rounded-[2px]"
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
                <div className="h-3 w-full bg-[#EEEEEE] rounded-[2px]" />
                <div className="h-3 w-2/3 bg-[#EEEEEE] rounded-[2px]" />
              </div>

              {/* Animated Cursor */}
              <motion.div
                className="absolute z-20 pointer-events-none drop-shadow-md"
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
      <section className="py-32 px-6 bg-white">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row-reverse items-center justify-between gap-16">
          <div className="w-full md:w-1/2 max-w-sm">
            <h2 className="text-[32px] font-medium text-[#171A20] mb-4">{m.landing_feature_models_title()}</h2>
            <p className="text-[16px] font-normal text-[#5C5E62] leading-[1.6]">
              {m.landing_feature_models_description()}
            </p>
          </div>
          <div className="w-full md:w-1/2 relative h-75 flex items-center justify-center">
            {/* Animation 2: Model Training */}
            <div className="relative w-85 h-60 flex items-center justify-between px-4">
              {/* Flowing Docs (Left -> Center) */}
              <div className="relative w-16 h-full flex flex-col items-center justify-center">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute w-10 h-14 bg-white border-2 border-[#EEEEEE] rounded-[2px] shadow-sm flex flex-col p-1.5 gap-1"
                    initial={{ x: -60, y: (i - 2) * 20, opacity: 0, scale: 0.8 }}
                    animate={{ x: 80, y: 0, opacity: [0, 1, 0], scale: [0.8, 1, 0.6] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.6,
                      ease: "easeInOut",
                    }}
                  >
                    <div className="w-full h-1 bg-[#D0D1D2] rounded-full" />
                    <div className="w-3/4 h-1 bg-[#D0D1D2] rounded-full" />
                    <div className="w-full h-1 bg-[#D0D1D2] rounded-full" />
                  </motion.div>
                ))}
              </div>

              {/* Model Core Engine (Center) */}
              <div className="relative w-28 h-28 bg-[#171A20] rounded-xl flex items-center justify-center z-10 shadow-lg border border-[#393C41]">
                {/* Rotating visual 1 */}
                <motion.div
                  className="absolute inset-0 border border-[#3E6AE1] rounded-xl m-2 opacity-50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, ease: "linear", repeat: Infinity }}
                />
                {/* Rotating visual 2 */}
                <motion.div
                  className="absolute inset-0 border border-dashed border-[#5C5E62] rounded-xl m-4"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, ease: "linear", repeat: Infinity }}
                />
                {/* Center Dot */}
                <motion.div
                  className="w-3 h-3 bg-[#3E6AE1] rounded-full shadow-[0_0_12px_#3E6AE1]"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Flowing JSON Outputs (Center -> Right) */}
              <div className="relative w-20 h-full flex flex-col items-center justify-center">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute w-20 h-10 bg-[#3E6AE1]/5 border border-[#3E6AE1]/30 rounded-lg flex items-center justify-center text-[#3E6AE1] text-[11px] font-mono shadow-sm"
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
      <section className="py-32 px-6 bg-[#F4F4F4]">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-16">
          <div className="w-full md:w-1/2 max-w-sm">
            <h2 className="text-[32px] font-medium text-[#171A20] mb-4">{m.landing_feature_integration_title()}</h2>
            <p className="text-[16px] font-normal text-[#5C5E62] leading-[1.6]">
              {m.landing_feature_integration_description()}
            </p>
          </div>
          <div className="w-full md:w-1/2 relative h-75 flex items-center justify-center">
            {/* Animation 3: Integration Pipes */}
            <div className="relative w-85 h-65 flex items-center">
              {/* Source Node */}
              <div className="w-25 h-25 bg-white border border-[#D0D1D2] flex flex-col items-center justify-center z-10 shadow-sm relative rounded-xl">
                <span className="text-[12px] font-semibold text-[#171A20] mb-1">{m.landing_feature_integration_pipeline()}</span>
                <div className="px-2 py-0.5 bg-[#3E6AE1]/10 text-[#3E6AE1] text-[10px] font-mono rounded-[2px] border border-[#3E6AE1]/20">
                  {m.landing_feature_integration_active()}
                </div>

                {/* Origin Pulse */}
                <motion.div
                  className="absolute -right-1 top-1/2 -mt-1 w-2 h-2 bg-[#3E6AE1] rounded-full"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>

              {/* Connection Trace Lines */}
              <div className="absolute left-25 w-25 h-40 flex items-center">
                {/* Middle Line */}
                <div className="w-full h-0.5 bg-[#EEEEEE]" />
                {/* Top Angled Line */}
                <div
                  className="absolute top-5 left-0 w-12.5 h-0.5 bg-[#EEEEEE]"
                  style={{ transformOrigin: "0 50%", rotate: "-40deg" }}
                />
                <div className="absolute top-0 right-0 w-15.5 h-0.5 bg-[#EEEEEE]" />
                {/* Bottom Angled Line */}
                <div
                  className="absolute bottom-5 left-0 w-12.5 h-0.5 bg-[#EEEEEE]"
                  style={{ transformOrigin: "0 50%", rotate: "40deg" }}
                />
                <div className="absolute bottom-0 right-0 w-15.5 h-0.5 bg-[#EEEEEE]" />

                {/* Flowing Data Pellets */}
                <motion.div
                  className="absolute h-1.5 w-1.5 bg-[#3E6AE1] rounded-full top-[50%] -mt-0.75"
                  initial={{ left: 0 }}
                  animate={{ left: "100%" }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                  className="absolute h-1.5 w-1.5 bg-[#3E6AE1] rounded-full -top-0.75"
                  initial={{ left: 0, top: "50%" }}
                  animate={{ left: ["0%", "30%", "100%"], top: ["50%", "0%", "0%"] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.3, ease: "linear" }}
                />
                <motion.div
                  className="absolute h-1.5 w-1.5 bg-[#3E6AE1] rounded-full -bottom-0.75"
                  initial={{ left: 0, top: "50%" }}
                  animate={{ left: ["0%", "30%", "100%"], top: ["50%", "100%", "100%"] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.6, ease: "linear" }}
                />
              </div>

              {/* Destinations */}
              <div className="absolute right-0 h-47.5 w-32.5 flex flex-col justify-between py-1 z-10">
                <div className="w-25 h-12 bg-white border border-[#D0D1D2] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center ml-auto rounded-xl">
                  <span className="text-[12px] font-medium text-[#5C5E62]">{m.landing_feature_integration_rest_api()}</span>
                </div>
                {/* Mid Dest / Highlighted */}
                <motion.div
                  className="w-30 h-14.5 bg-white border-2 border-[#3E6AE1] shadow-[0_4px_16px_rgba(62,106,225,0.15)] flex flex-col items-center justify-center rounded-xl ml-auto relative"
                  animate={{ y: [-2, 2, -2] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="text-[13px] font-semibold text-[#171A20]">{m.landing_feature_integration_postgresql()}</span>
                  <span className="text-[10px] text-[#3E6AE1] font-mono mt-0.5">{m.landing_feature_integration_synced_ago({ time: "1s" })}</span>
                </motion.div>
                {/* Bottom Dest */}
                <div className="w-25 h-12 bg-white border border-[#D0D1D2] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center ml-auto rounded-xl">
                  <span className="text-[12px] font-medium text-[#5C5E62]">{m.landing_feature_integration_webhook()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tweets Section */}
      <section className="py-32 px-6 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-[32px] font-medium text-[#171A20] mb-4">{m.landing_tweets_title()}</h2>
            <p className="text-[16px] font-normal text-[#5C5E62]">
              {m.landing_tweets_description()}
            </p>
          </div>

          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full relative"
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
      <section className="py-40 px-6 flex flex-col items-center justify-center text-center bg-[#F4F4F4] min-h-[50vh]">
        <h2 className="text-[40px] font-medium text-[#171A20] mb-6">{m.landing_demo_title()}</h2>
        <p className="text-[16px] font-normal text-[#393C41] mb-10 max-w-md">
          {m.landing_demo_description()}
        </p>
        <Link
          to="/demo"
          className="rounded-lg bg-[#3E6AE1] px-16 py-4 flex items-center justify-center text-[15px] font-medium text-white transition-all duration-330 hover:bg-[#2e52b5] shadow-[0_4px_14px_0_rgba(62,106,225,0.39)] hover:shadow-[0_6px_20px_rgba(62,106,225,0.23)] hover:-translate-y-0.5"
        >
          {m.landing_demo_cta()}
        </Link>
      </section>
    </div>
  )
}

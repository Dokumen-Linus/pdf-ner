import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components"

export const subject = "Thanks for reaching out to Dokumen AI"

export type ContactAutoReplyProps = {
  name: string
}

export default function ContactAutoReply({ name }: ContactAutoReplyProps) {
  const greeting = name.trim().length > 0 ? name : "there"
  return (
    <Html lang="en">
      <Head />
      <Preview>Thanks for reaching out &mdash; I&apos;ll be in touch shortly</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h2}>Thanks for reaching out!</Heading>
          <Text>Hi {greeting},</Text>
          <Text>
            I received your message and will get back to you shortly. This is an automated
            confirmation — no need to reply.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>— The Dokumen AI team</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }
const container = { maxWidth: "600px", margin: "0 auto", padding: "24px" }
const h2 = { color: "#333" }
const hr = { margin: "30px 0", border: "none", borderTop: "1px solid #eee" }
const footer = { color: "#666", fontSize: "12px" }

import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components"

export const subject = "New contact form submission"

export type ContactNotificationProps = {
  name: string
  email: string
  message: string
}

export default function ContactNotification({ name, email, message }: ContactNotificationProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>New contact form submission from {name}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h2}>New contact form submission</Heading>
          <Text>
            <strong>Name:</strong> {name}
          </Text>
          <Text>
            <strong>Email:</strong> {email}
          </Text>
          <Hr style={hr} />
          <Heading as="h3" style={h3}>
            Message
          </Heading>
          <Text style={messageStyle}>{message}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }
const container = { maxWidth: "600px", margin: "0 auto", padding: "24px" }
const h2 = { color: "#333" }
const h3 = { color: "#333", fontSize: "16px" }
const hr = { margin: "24px 0", border: "none", borderTop: "1px solid #eee" }
const messageStyle = { whiteSpace: "pre-wrap" as const }

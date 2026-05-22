import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components"

export const subject = "New job application submitted"

export type ApplicationNotificationProps = {
  name: string
  email: string
  phone?: string | null
  message?: string | null
}

export default function ApplicationNotification({
  name,
  email,
  phone,
  message,
}: ApplicationNotificationProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>New job application from {name}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h2}>New Job Application</Heading>
          <Text>
            <strong>Name:</strong> {name}
          </Text>
          <Text>
            <strong>Email:</strong> {email}
          </Text>
          {phone && (
            <Text>
              <strong>Phone:</strong> {phone}
            </Text>
          )}
          <Hr style={hr} />
          {message && (
            <>
              <Heading as="h3" style={h3}>
                Cover Letter / Message
              </Heading>
              <Text style={messageStyle}>{message}</Text>
            </>
          )}
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

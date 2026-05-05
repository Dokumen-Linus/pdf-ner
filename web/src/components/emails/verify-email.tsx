import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components"

export const subject = "Verify your email address"

export type VerifyEmailProps = {
  name?: string | null
  url: string
}

export default function VerifyEmail({ name, url }: VerifyEmailProps) {
  const greeting = name && name.trim().length > 0 ? name : "there"
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your Dokumen AI email address</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h2}>Welcome to Dokumen AI!</Heading>
          <Text>Hi {greeting},</Text>
          <Text>
            Thank you for signing up! Please click the link below to verify your email address:
          </Text>
          <Button href={url} style={button}>
            Verify Email Address
          </Button>
          <Text>If the button doesn&apos;t work, copy and paste this link into your browser:</Text>
          <Link href={url} style={rawLink}>
            {url}
          </Link>
          <Text>This link will expire in 24 hours.</Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }
const container = { maxWidth: "600px", margin: "0 auto", padding: "24px" }
const h2 = { color: "#333" }
const button = {
  backgroundColor: "#007cba",
  color: "#ffffff",
  padding: "12px 24px",
  textDecoration: "none",
  borderRadius: "5px",
  display: "inline-block",
}
const rawLink = { wordBreak: "break-all" as const, color: "#666" }
const hr = { margin: "30px 0", border: "none", borderTop: "1px solid #eee" }
const footer = { color: "#666", fontSize: "12px" }

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

export const subject = "Reset your password"

export type ResetPasswordProps = {
  name?: string | null
  url: string
}

export default function ResetPassword({ name, url }: ResetPasswordProps) {
  const greeting = name && name.trim().length > 0 ? name : "there"
  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your Dokumen AI password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h2}>Reset your password</Heading>
          <Text>Hi {greeting},</Text>
          <Text>
            We received a request to reset your password. Click the button below to choose a new
            one:
          </Text>
          <Button href={url} style={button}>
            Reset Password
          </Button>
          <Text>If the button doesn&apos;t work, copy and paste this link into your browser:</Text>
          <Link href={url} style={rawLink}>
            {url}
          </Link>
          <Text>This link will expire in 1 hour.</Text>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t request a password reset, you can safely ignore this email &mdash;
            your password will not change.
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

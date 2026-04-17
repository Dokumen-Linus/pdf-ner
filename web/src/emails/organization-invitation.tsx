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

export const subject = "You've been invited to a workspace on Dokumen AI"

export type OrganizationInvitationProps = {
  invitedByName?: string | null
  organizationName: string
  url: string
}

export default function OrganizationInvitation({
  invitedByName,
  organizationName,
  url,
}: OrganizationInvitationProps) {
  const inviter = invitedByName && invitedByName.trim().length > 0 ? invitedByName : "A teammate"
  return (
    <Html lang="en">
      <Head />
      <Preview>Join {organizationName} on Dokumen AI</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h2}>You&apos;ve been invited</Heading>
          <Text>
            {inviter} has invited you to join <strong>{organizationName}</strong> on Dokumen AI.
          </Text>
          <Button href={url} style={button}>
            Accept Invitation
          </Button>
          <Text>If the button doesn&apos;t work, copy and paste this link into your browser:</Text>
          <Link href={url} style={rawLink}>
            {url}
          </Link>
          <Hr style={hr} />
          <Text style={footer}>
            If you weren&apos;t expecting this invitation, you can safely ignore this email.
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

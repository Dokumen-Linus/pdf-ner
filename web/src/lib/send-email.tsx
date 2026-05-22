import { SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses"
import { render } from "@react-email/components"

import ApplicationNotification from "../components/emails/application-notification"

import ContactAutoReply, {
  subject as contactAutoReplySubject,
} from "../components/emails/contact-auto-reply"
import ContactNotification, {
  subject as contactNotificationSubject,
} from "../components/emails/contact-notification"
import OrganizationInvitation, {
  subject as organizationInvitationSubject,
} from "../components/emails/organization-invitation"
import ResetPassword, { subject as resetPasswordSubject } from "../components/emails/reset-password"
import VerifyEmail, { subject as verifyEmailSubject } from "../components/emails/verify-email"
import { env } from "../env.server"
import { sesClient } from "../integrations/ses"

import type { ContactAutoReplyProps } from "../components/emails/contact-auto-reply"
import type { ContactNotificationProps } from "../components/emails/contact-notification"
import type { OrganizationInvitationProps } from "../components/emails/organization-invitation"
import type { ResetPasswordProps } from "../components/emails/reset-password"
import type { VerifyEmailProps } from "../components/emails/verify-email"

type TemplateMap = {
  "verify-email": VerifyEmailProps
  "reset-password": ResetPasswordProps
  "organization-invitation": OrganizationInvitationProps
  "contact-auto-reply": ContactAutoReplyProps
  "contact-notification": ContactNotificationProps
}

type TemplateKey = keyof TemplateMap

const registry: {
  [K in TemplateKey]: {
    subject: string
    render: (props: TemplateMap[K]) => Promise<string>
  }
} = {
  "verify-email": {
    subject: verifyEmailSubject,
    render: (props) => render(<VerifyEmail {...props} />),
  },
  "reset-password": {
    subject: resetPasswordSubject,
    render: (props) => render(<ResetPassword {...props} />),
  },
  "organization-invitation": {
    subject: organizationInvitationSubject,
    render: (props) => render(<OrganizationInvitation {...props} />),
  },
  "contact-auto-reply": {
    subject: contactAutoReplySubject,
    render: (props) => render(<ContactAutoReply {...props} />),
  },
  "contact-notification": {
    subject: contactNotificationSubject,
    render: (props) => render(<ContactNotification {...props} />),
  },
}

export type SendEmailArgs<K extends TemplateKey> = {
  to: string | string[]
  template: K
  props: TemplateMap[K]
  replyTo?: string | string[]
  subjectOverride?: string
}

export async function sendEmail<K extends TemplateKey>(args: SendEmailArgs<K>): Promise<void> {
  const entry = registry[args.template]
  const html = await entry.render(args.props)
  const toAddresses = Array.isArray(args.to) ? args.to : [args.to]
  const replyToAddresses = args.replyTo
    ? Array.isArray(args.replyTo)
      ? args.replyTo
      : [args.replyTo]
    : undefined

  await sesClient.send(
    new SendEmailCommand({
      Source: env.FROM_EMAIL,
      Destination: { ToAddresses: toAddresses },
      ReplyToAddresses: replyToAddresses,
      Message: {
        Subject: { Charset: "UTF-8", Data: args.subjectOverride ?? entry.subject },
        Body: { Html: { Charset: "UTF-8", Data: html } },
      },
    }),
  )
}

export async function sendApplicationEmail(args: {
  name: string
  email: string
  phone?: string | null
  message?: string | null
  resume: {
    filename: string
    content: string // Base64 encoded PDF bytes
  }
}): Promise<void> {
  const html = await render(
    <ApplicationNotification
      name={args.name}
      email={args.email}
      phone={args.phone}
      message={args.message}
    />,
  )

  const boundary = "----=_Part_" + Math.random().toString(36).substring(2)
  const mimeParts = [
    `From: ${env.FROM_EMAIL}`,
    `To: ${env.MY_EMAIL}`,
    `Subject: New job application from ${args.name}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    html,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${args.resume.filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${args.resume.filename}"`,
    ``,
    args.resume.content,
    ``,
    `--${boundary}--`,
  ]
  const rawMessage = mimeParts.join("\r\n")

  await sesClient.send(
    new SendRawEmailCommand({
      RawMessage: {
        Data: new TextEncoder().encode(rawMessage),
      },
    }),
  )
}

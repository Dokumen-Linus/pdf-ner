import { SendEmailCommand } from "@aws-sdk/client-ses"
import { render } from "@react-email/components"

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

import { SendEmailCommand } from "@aws-sdk/client-ses"
import { render } from "@react-email/components"
import ContactAutoReply, {
  type ContactAutoReplyProps,
  subject as contactAutoReplySubject,
} from "../../emails/contact-auto-reply"
import ContactNotification, {
  type ContactNotificationProps,
  subject as contactNotificationSubject,
} from "../../emails/contact-notification"
import OrganizationInvitation, {
  type OrganizationInvitationProps,
  subject as organizationInvitationSubject,
} from "../../emails/organization-invitation"
import ResetPassword, {
  type ResetPasswordProps,
  subject as resetPasswordSubject,
} from "../../emails/reset-password"
import VerifyEmail, {
  type VerifyEmailProps,
  subject as verifyEmailSubject,
} from "../../emails/verify-email"
import { env } from "../../env.server"
import { sesClient } from "../../integrations/ses"

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

export async function sendEmail<K extends TemplateKey>(
  args: SendEmailArgs<K>
): Promise<void> {
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
    })
  )
}

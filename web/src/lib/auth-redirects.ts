export const DEFAULT_POST_VERIFICATION_REDIRECT = "/profile"

export function getPostVerificationRedirect(redirect?: string): string {
  const trimmedRedirect = redirect?.trim()

  return trimmedRedirect ? trimmedRedirect : DEFAULT_POST_VERIFICATION_REDIRECT
}

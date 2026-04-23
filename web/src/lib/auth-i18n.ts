import { cookieName as paraglideLocaleCookieName } from "@/integrations/paraglide/runtime"

export const BETTER_AUTH_ERROR_REDIRECT_PATH = "/error"
export const BETTER_AUTH_LOCALE_COOKIE_NAME = paraglideLocaleCookieName

export const AUTH_LOCALES = ["en", "fr"] as const

export type AuthLocale = (typeof AUTH_LOCALES)[number]

type AuthTranslationDictionary = Record<string, string>

function getCookieValue(cookieHeader: string | null | undefined, cookieName: string) {
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=")
    if (rawName === cookieName) {
      return rawValue.join("=") || null
    }
  }

  return null
}

export function normalizeAuthLocale(locale: string | null | undefined): AuthLocale {
  if (typeof locale !== "string") return "en"
  return locale.toLowerCase().startsWith("fr") ? "fr" : "en"
}

export function detectAuthLocaleFromHeaders(headers: Headers | null | undefined) {
  const localeCookie = getCookieValue(headers?.get("Cookie"), BETTER_AUTH_LOCALE_COOKIE_NAME)
  if (localeCookie) return normalizeAuthLocale(localeCookie)

  const acceptLanguage = headers?.get("Accept-Language")
  if (!acceptLanguage) return "en"

  const firstLocale = acceptLanguage.split(",")[0]?.trim()
  return normalizeAuthLocale(firstLocale)
}

const frApiErrorTranslations: AuthTranslationDictionary = {
  USER_NOT_FOUND: "Utilisateur introuvable",
  FAILED_TO_CREATE_USER: "Impossible de creer l'utilisateur",
  FAILED_TO_CREATE_SESSION: "Impossible de creer la session",
  FAILED_TO_UPDATE_USER: "Impossible de mettre a jour l'utilisateur",
  FAILED_TO_GET_SESSION: "Impossible de recuperer la session",
  INVALID_PASSWORD: "Mot de passe invalide",
  INVALID_EMAIL: "E-mail invalide",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe invalide",
  INVALID_USER: "Utilisateur invalide",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "Le compte social est deja lie",
  PROVIDER_NOT_FOUND: "Fournisseur introuvable",
  INVALID_TOKEN: "Jeton invalide",
  TOKEN_EXPIRED: "Jeton expire",
  ID_TOKEN_NOT_SUPPORTED: "id_token n'est pas pris en charge",
  FAILED_TO_GET_USER_INFO: "Impossible de recuperer les informations de l'utilisateur",
  USER_EMAIL_NOT_FOUND: "E-mail de l'utilisateur introuvable",
  EMAIL_NOT_VERIFIED: "E-mail non verifie",
  PASSWORD_TOO_SHORT: "Le mot de passe est trop court",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long",
  USER_ALREADY_EXISTS: "Cet utilisateur existe deja.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Cet utilisateur existe deja. Utilisez une autre adresse e-mail.",
  EMAIL_CAN_NOT_BE_UPDATED: "L'adresse e-mail ne peut pas etre modifiee",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Compte d'identification introuvable",
  SESSION_EXPIRED: "La session a expire. Reauthentifiez-vous pour effectuer cette action.",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "Vous ne pouvez pas dissocier votre dernier compte",
  ACCOUNT_NOT_FOUND: "Compte introuvable",
  USER_ALREADY_HAS_PASSWORD:
    "Cet utilisateur possede deja un mot de passe. Fournissez-le pour supprimer le compte.",
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED:
    "Connexion bloquee lors d'une navigation intersite. Cette requete semble etre une attaque CSRF.",
  VERIFICATION_EMAIL_NOT_ENABLED: "La verification de l'adresse e-mail n'est pas activee",
  EMAIL_ALREADY_VERIFIED: "L'adresse e-mail est deja verifiee",
  EMAIL_MISMATCH: "L'adresse e-mail ne correspond pas",
  SESSION_NOT_FRESH: "La session n'est pas assez recente",
  LINKED_ACCOUNT_ALREADY_EXISTS: "Le compte lie existe deja",
  INVALID_ORIGIN: "Origine invalide",
  INVALID_CALLBACK_URL: "callbackURL invalide",
  INVALID_REDIRECT_URL: "redirectURL invalide",
  INVALID_ERROR_CALLBACK_URL: "errorCallbackURL invalide",
  INVALID_NEW_USER_CALLBACK_URL: "newUserCallbackURL invalide",
  MISSING_OR_NULL_ORIGIN: "L'en-tete Origin est manquant ou nul",
  CALLBACK_URL_REQUIRED: "callbackURL est obligatoire",
  FAILED_TO_CREATE_VERIFICATION: "Impossible de creer la verification",
  FIELD_NOT_ALLOWED: "Ce champ ne peut pas etre defini",
  ASYNC_VALIDATION_NOT_SUPPORTED: "La validation asynchrone n'est pas prise en charge",
  VALIDATION_ERROR: "Erreur de validation",
  MISSING_FIELD: "Ce champ est obligatoire",
  METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED:
    "La methode POST exige que deferSessionRefresh soit active dans la configuration de session",
  BODY_MUST_BE_AN_OBJECT: "Le corps de la requete doit etre un objet",
  PASSWORD_ALREADY_SET: "L'utilisateur possede deja un mot de passe",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION:
    "Vous n'etes pas autorise a creer une nouvelle organisation",
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS:
    "Vous avez atteint le nombre maximal d'organisations",
  ORGANIZATION_ALREADY_EXISTS: "Cette organisation existe deja",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "Ce slug d'organisation est deja utilise",
  ORGANIZATION_NOT_FOUND: "Organisation introuvable",
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION:
    "L'utilisateur n'est pas membre de cette organisation",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION:
    "Vous n'etes pas autorise a mettre a jour cette organisation",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION:
    "Vous n'etes pas autorise a supprimer cette organisation",
  NO_ACTIVE_ORGANIZATION: "Aucune organisation active",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION:
    "L'utilisateur est deja membre de cette organisation",
  MEMBER_NOT_FOUND: "Membre introuvable",
  ROLE_NOT_FOUND: "Role introuvable",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM:
    "Vous n'etes pas autorise a creer une nouvelle equipe",
  TEAM_ALREADY_EXISTS: "Cette equipe existe deja",
  TEAM_NOT_FOUND: "Equipe introuvable",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER:
    "Vous ne pouvez pas quitter l'organisation en tant qu'unique proprietaire",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER:
    "Vous ne pouvez pas quitter l'organisation sans proprietaire",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER:
    "Vous n'etes pas autorise a supprimer ce membre",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION:
    "Vous n'etes pas autorise a inviter des utilisateurs dans cette organisation",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION:
    "Cet utilisateur est deja invite dans cette organisation",
  INVITATION_NOT_FOUND: "Invitation introuvable",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "Vous n'etes pas le destinataire de cette invitation",
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION:
    "La verification de l'adresse e-mail est requise avant d'accepter ou de refuser l'invitation",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION:
    "Vous n'etes pas autorise a annuler cette invitation",
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION:
    "L'expediteur de l'invitation n'est plus membre de l'organisation",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE:
    "Vous n'etes pas autorise a inviter un utilisateur avec ce role",
  FAILED_TO_RETRIEVE_INVITATION: "Impossible de recuperer l'invitation",
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS:
    "Vous avez atteint le nombre maximal d'equipes",
  UNABLE_TO_REMOVE_LAST_TEAM: "Impossible de supprimer la derniere equipe",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER:
    "Vous n'etes pas autorise a mettre a jour ce membre",
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED:
    "La limite de membres de l'organisation est atteinte",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION:
    "Vous n'etes pas autorise a creer des equipes dans cette organisation",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION:
    "Vous n'etes pas autorise a supprimer des equipes dans cette organisation",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM:
    "Vous n'etes pas autorise a mettre a jour cette equipe",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM:
    "Vous n'etes pas autorise a supprimer cette equipe",
  INVITATION_LIMIT_REACHED: "La limite d'invitations est atteinte",
  TEAM_MEMBER_LIMIT_REACHED: "La limite de membres de l'equipe est atteinte",
  USER_IS_NOT_A_MEMBER_OF_THE_TEAM: "L'utilisateur n'est pas membre de cette equipe",
  YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM:
    "Vous n'etes pas autorise a consulter les membres de cette equipe",
  YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: "Vous n'avez pas d'equipe active",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER:
    "Vous n'etes pas autorise a ajouter un nouveau membre d'equipe",
  YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER:
    "Vous n'etes pas autorise a retirer un membre de l'equipe",
  YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION:
    "Vous n'etes pas autorise a acceder a cette organisation",
  YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION:
    "Vous n'etes pas membre de cette organisation",
  MISSING_AC_INSTANCE:
    "Le controle d'acces dynamique exige une instance AC predefinie dans le plugin d'authentification serveur. Consultez les journaux serveur pour plus d'informations.",
  YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE:
    "Vous devez appartenir a une organisation pour creer un role",
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE:
    "Vous n'etes pas autorise a creer un role",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE:
    "Vous n'etes pas autorise a mettre a jour un role",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE:
    "Vous n'etes pas autorise a supprimer un role",
  YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: "Vous n'etes pas autorise a lire un role",
  YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE:
    "Vous n'etes pas autorise a lister les roles",
  YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE:
    "Vous n'etes pas autorise a recuperer un role",
  TOO_MANY_ROLES: "Cette organisation possede trop de roles",
  INVALID_RESOURCE: "La permission fournie inclut une ressource invalide",
  ROLE_NAME_IS_ALREADY_TAKEN: "Ce nom de role est deja utilise",
  CANNOT_DELETE_A_PRE_DEFINED_ROLE: "Impossible de supprimer un role predefini",
  ROLE_IS_ASSIGNED_TO_MEMBERS:
    "Impossible de supprimer un role attribue a des membres. Reattribuez d'abord ces membres a un autre role.",
  PASSWORD_COMPROMISED:
    "Le mot de passe saisi a ete compromis. Veuillez en choisir un autre.",
  ORGANIZATION_DELETION_DISABLED: "La suppression de l'organisation est desactivee",
}

export const betterAuthApiErrorTranslations: Record<AuthLocale, AuthTranslationDictionary> = {
  en: {},
  fr: frApiErrorTranslations,
}

const enApiMessageTranslations: AuthTranslationDictionary = {
  "Change email is disabled": "Change email is disabled",
  "Email is the same": "Email is the same",
  "Invitation not found!": "Invitation not found!",
  "Missing session headers, or email query parameter.":
    "Missing session headers, or email query parameter.",
  "No fields to update": "No fields to update",
  "Not a member of this organization": "Not a member of this organization",
  "Not authenticated": "Not authenticated",
  "Organization ID is required": "Organization ID is required",
  "Organization plugin is required for org role authorization":
    "Organization plugin is required for org role authorization",
  "Teams are not enabled": "Teams are not enabled",
  "User email cannot be passed for client side API calls.":
    "User email cannot be passed for client side API calls.",
  "User not found": "User not found",
  "Verification email isn't enabled": "Verification email isn't enabled",
}

const frApiMessageTranslations: AuthTranslationDictionary = {
  "Change email is disabled": "Le changement d'adresse e-mail est desactive",
  "Email is the same": "L'adresse e-mail est identique",
  "Invitation not found!": "Invitation introuvable",
  "Missing session headers, or email query parameter.":
    "Les en-tetes de session sont manquants ou le parametre de requete email est absent.",
  "No fields to update": "Aucun champ a mettre a jour",
  "Not a member of this organization": "Vous n'etes pas membre de cette organisation",
  "Not authenticated": "Non authentifie",
  "Organization ID is required": "L'identifiant de l'organisation est obligatoire",
  "Organization plugin is required for org role authorization":
    "Le plugin Organization est requis pour l'autorisation par role d'organisation",
  "Teams are not enabled": "Les equipes ne sont pas activees",
  "User email cannot be passed for client side API calls.":
    "L'adresse e-mail de l'utilisateur ne peut pas etre transmise lors d'appels API cote client.",
  "User not found": "Utilisateur introuvable",
  "Verification email isn't enabled": "La verification de l'adresse e-mail n'est pas activee",
}

export const betterAuthApiMessageTranslations: Record<AuthLocale, AuthTranslationDictionary> = {
  en: enApiMessageTranslations,
  fr: frApiMessageTranslations,
}

export function getLocalizedAuthApiMessage(
  message: string | null | undefined,
  locale: string | null | undefined,
) {
  if (!message) return null
  const normalizedLocale = normalizeAuthLocale(locale)
  return betterAuthApiMessageTranslations[normalizedLocale][message] ?? null
}

const enRedirectErrorTranslations: AuthTranslationDictionary = {
  access_denied: "Access denied",
  banned: "You have been banned from this application",
  client_disabled: "Client is disabled",
  consent_required: "Consent is required to continue",
  ["email_doesn't_match"]: "The e-mail address does not match",
  email_not_found: "E-mail address not found",
  internal_server_error: "Internal server error",
  invalid_callback_request: "Invalid callback request",
  invalid_client: "Invalid client",
  invalid_code: "Invalid code",
  invalid_payload: "Invalid payload",
  invalid_profile: "Invalid profile",
  invalid_request: "Invalid request",
  invalid_scope: "Invalid scope",
  login_required: "Login is required",
  missing_profile: "Missing profile",
  no_callback_url: "Missing callback URL",
  no_code: "Missing authorization code",
  oauth_provider_not_found: "OAuth provider not found",
  payload_expired: "Payload has expired",
  please_restart_the_process: "Please restart the process",
  server_error: "Server error",
  signup_disabled: "Sign-up is disabled",
  state_mismatch: "State mismatch",
  state_not_found: "State not found",
  unable_to_create_session: "Unable to create session",
  unable_to_create_user: "Unable to create user",
  unable_to_get_user_info: "Unable to get user info",
  unable_to_link_account: "Unable to link account",
  account_not_linked: "Account is not linked",
  account_already_linked_to_different_user:
    "Account is already linked to a different user",
  unsupported_response_type: "Unsupported response type",
  user_creation_failed: "User creation failed",
}

const frRedirectErrorTranslations: AuthTranslationDictionary = {
  access_denied: "Acces refuse",
  banned: "Vous avez ete banni de cette application",
  client_disabled: "Le client est desactive",
  consent_required: "Le consentement est requis pour continuer",
  ["email_doesn't_match"]: "L'adresse e-mail ne correspond pas",
  email_not_found: "Adresse e-mail introuvable",
  internal_server_error: "Erreur interne du serveur",
  invalid_callback_request: "Requete de rappel invalide",
  invalid_client: "Client invalide",
  invalid_code: "Code invalide",
  invalid_payload: "Charge utile invalide",
  invalid_profile: "Profil invalide",
  invalid_request: "Requete invalide",
  invalid_scope: "Portee invalide",
  login_required: "La connexion est requise",
  missing_profile: "Profil manquant",
  no_callback_url: "URL de rappel manquante",
  no_code: "Code d'autorisation manquant",
  oauth_provider_not_found: "Fournisseur OAuth introuvable",
  payload_expired: "La charge utile a expire",
  please_restart_the_process: "Veuillez recommencer le processus",
  server_error: "Erreur du serveur",
  signup_disabled: "L'inscription est desactivee",
  state_mismatch: "L'etat ne correspond pas",
  state_not_found: "Etat introuvable",
  unable_to_create_session: "Impossible de creer la session",
  unable_to_create_user: "Impossible de creer l'utilisateur",
  unable_to_get_user_info: "Impossible de recuperer les informations de l'utilisateur",
  unable_to_link_account: "Impossible de lier le compte",
  account_not_linked: "Le compte n'est pas lie",
  account_already_linked_to_different_user:
    "Le compte est deja lie a un autre utilisateur",
  unsupported_response_type: "Type de reponse non pris en charge",
  user_creation_failed: "La creation de l'utilisateur a echoue",
}

export const betterAuthRedirectErrorTranslations: Record<AuthLocale, AuthTranslationDictionary> = {
  en: enRedirectErrorTranslations,
  fr: frRedirectErrorTranslations,
}

const authErrorPageChrome = {
  en: {
    title: "Something went wrong",
    description:
      "We couldn't finish the authentication flow. Please review the error below and try again.",
    unknownError: "Unknown authentication error",
    tryAgain: "Try again",
    goHome: "Go home",
    errorCodeLabel: "Error code",
  },
  fr: {
    title: "Un probleme est survenu",
    description:
      "Nous n'avons pas pu terminer le parcours d'authentification. Verifiez l'erreur ci-dessous puis reessayez.",
    unknownError: "Erreur d'authentification inconnue",
    tryAgain: "Reessayer",
    goHome: "Retour a l'accueil",
    errorCodeLabel: "Code d'erreur",
  },
} as const

export function getAuthErrorPageCopy(locale: string | null | undefined) {
  return authErrorPageChrome[normalizeAuthLocale(locale)]
}

export function getLocalizedAuthRedirectError(
  errorCode: string | null | undefined,
  locale: string | null | undefined,
) {
  if (!errorCode) return null
  const normalizedLocale = normalizeAuthLocale(locale)
  const translations = betterAuthRedirectErrorTranslations[normalizedLocale]

  return translations[errorCode] ?? null
}

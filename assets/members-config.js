// Bella Betting members configuration.
// joinEndpoint: Twilio Function in the separate "bella-betting-members" service (stores members in Twilio Sync keyed by E.164 mobile).
// LIVE must stay false until Damien approves launch (legal review of NSW s30, privacy contact email, email provider set up).
window.BB_MEMBERS = {
  LIVE: false,
  joinEndpoint: "https://bella-betting-members-6300-prod.twil.io/join",
  verifyEndpoint: "https://bella-betting-members-6300-prod.twil.io/verify-check",
  // Email provider (recommended: beehiiv). Needs Damien's account; the members service will push sign-ups to it via API once set.
  emailProvider: "PLACEHOLDER_BEEHIIV_NOT_CONNECTED"
};

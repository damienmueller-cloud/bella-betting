// Bella Betting members configuration.
// joinEndpoint: Twilio Function in the separate "bella-betting-members" service (stores members in Twilio Sync keyed by E.164 mobile).
// LIVE: approved by Damien 10 Oct 2026. Email provider (beehiiv) is a later step; sign-ups are stored in Twilio Sync.
window.BB_MEMBERS = {
  LIVE: true,
  joinEndpoint: "https://bella-betting-members-6300-prod.twil.io/join",
  verifyEndpoint: "https://bella-betting-members-6300-prod.twil.io/verify-check",
  // Email provider (recommended: beehiiv). Needs Damien's account; the members service will push sign-ups to it via API once set.
  emailProvider: "none-yet (beehiiv planned)"
};

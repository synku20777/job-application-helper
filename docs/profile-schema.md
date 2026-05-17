# Profile Schema

The canonical profile schema is `CandidateProfile` version `1.0.0` in `packages/profile-schema`. Profiles are imported and exported as JSON, validated with Zod, and stored locally by profile id.

The first MVP stores profiles in IndexedDB without passphrase encryption. Encryption is reserved for the production hardening phase.

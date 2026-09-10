# F04 release proof

This owner-authored marker freezes the current Corporate Development & M&A validation candidate after generated database types, formatting and initial PR review corrections have been normalised.

The candidate contains the canonical data spine for F04.01–F04.07, the Corporate Development command centre, governed transaction/partnership approval gates, valuation revision supersession, attributable opportunity stage transitions, real-MySQL proof scaffolding and browser coverage.

Initial review corrections addressed before this validation candidate:

- valuation creation records the implicit pipeline transition to `valuation` in stage history and audit/outbox evidence;
- valuation revisions reference their predecessor and supersede the previously approved version atomically on approval;
- business identifier/source-domain validation respects the schema's 50-character boundary;
- Corporate Development is registered in the strategy-permission-gated workspace directory.

This candidate must not be merged until exact-head Complete System Validation is green and all remaining review findings are resolved.
# Localization and accessibility

Use Flutter ARB resources for all interface strings in Uzbek Latin (`uz`), Russian (`ru`) and English (`en`). Persist locale preference in M3/M4. Facility and sport translations live in database rows; user-created descriptions remain in their original language. Display Namangan; use Asia/Tashkent only as scheduling metadata. Format UZS amounts and dates using locale conventions without changing canonical server values.

Design: deep green #166534, white, charcoal, pale green surfaces and restrained amber. Verify contrast before freezing tokens. Mobile bottom navigation, tablet rail and constrained desktop layouts; owner calendars/admin tables need desktop-specific controls. Keyboard/focus, semantic labels, screen readers, large text, reduced motion, skeletons and meaningful empty/error/offline states are mandatory M4/M12 checks. Cached information must never imply successful offline reservation.

ARB completeness and placeholder compatibility are CI gates. Translation accuracy still requires native-language review before release.

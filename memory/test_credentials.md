# Test Credentials

## Live seeded accounts (use these for testing/login flows)

- **Super Admin**: superadmin@oryno.com / testpassword123
- **Admin**: admin@test.com / testpassword123
- **Customer**: customer@test.com / testpassword123
- **Operator**: operator@test.com / testpassword123 (Musango Bus Service — travel + restaurants; role=`operator`, operator_id=`30c487d8-f8ef-4e80-8b14-1a68866071c8`)
- **Netflix Operator**: netflix.cinema@test.com / testpassword123 (Netflix — cinema; has `cinema.manage_screenings`)


## Protected Super-Admin (bootstrap account — un-deletable, auto-seeded on every startup)
- **Super Admin**: superadmin@oryno.com / testpassword123
  - Has `is_system_account=True` and `is_protected=True` flags
  - Cannot be deleted via the API (HTTP 403)
  - Re-created automatically on backend startup if missing
  - Override defaults via env vars: `PROTECTED_SUPER_ADMIN_EMAIL`, `PROTECTED_SUPER_ADMIN_PASSWORD`
  - Existing accounts are NEVER password-overwritten — admin can rotate password via the reset-password flow

## Dev / Preview Seed Accounts (created once on first startup, password kept fresh)
- **Admin**: admin@test.com / testpassword123
- **Customer**: customer@test.com / testpassword123
- **Operator**: operator@test.com / testpassword123 (Musango Bus Service — travel + restaurants)
- **Cinema Operator**: mani-monroe@netflix.com / testpassword123 (Netflix — cinema; has `cinema.manage_screenings`)

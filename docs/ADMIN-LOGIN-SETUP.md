# Administrator access

The administrator page is at `/admin`. It has one password field. Staff do not need a username. The visitor password is separate. If the visitor gate is on, enter the visitor password first.

## Sign in and change the password

1. Open `/admin` and enter the current administrator password.
2. Select **Reset Password** on the sign-in page or dashboard.
3. Enter the current password. Enter the new password twice. The new password must have at least 12 characters, a letter, and a number.
4. Select **Save new password**. Sign in again on other devices. The old password and old administrator sessions stop working.

This process does not use email or text messages. A person who does not know the current password cannot use the form to change it. Keep the password in an approved password manager. Do not send it by email or chat.

## Initial setup and recovery

The server needs its existing Supabase project URL, public key, service-role key, and `ADMIN_DASHBOARD_PASSWORD` environment value. The service-role key stays on the server. Migration `0019_admin_access.sql` must be applied before this version of the site goes live. The new table starts empty, so the existing environment password works until the first successful password change. After that change, the saved database hash becomes the only administrator password. A later change to `ADMIN_DASHBOARD_PASSWORD` alone will not change access.

If the current password is lost, the account owner must use the Supabase control plane to recover access. The owner can remove the `admin_access` row to restore the environment password, or replace its hash through a reviewed recovery procedure. There is no public recovery form. Verify the active password and access after recovery. Do not put password values in tickets, source files, or messages.

## Release check

Before release, confirm the migration in the client Supabase project and confirm the hosting environment values. On a preview, verify sign-in, a harmless dashboard edit, password change, rejection of the old password, and rejection of the old session. Check `/admin-dashboard` redirects to `/admin`. The site owner must verify the result on the live site after release.

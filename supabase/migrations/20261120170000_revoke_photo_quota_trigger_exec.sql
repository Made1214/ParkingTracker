-- Revoca el permiso EXECUTE heredado de PUBLIC en las funciones trigger de cuota.
revoke all on function private.enforce_photo_quota() from public;
revoke all on function private.release_photo_quota() from public;

# Privileged database code

Application code uses only the public key plus the user's JWT. Elevated operations are explicitly limited to the functions below. Each is defined with an empty `search_path` and qualified table references. Function ACLs revoke default execution and grant it only where required.

| Function                                                   | Privilege rationale                                                      | Callable by                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `private.is_group_member(uuid)`                            | Read membership without recursive RLS                                    | authenticated, through policies |
| `private.is_group_admin(uuid)`                             | Same lookup, restricted to admin role                                    | authenticated, through policies |
| `private.shares_group_with(uuid)`                          | Read shared membership for profile visibility                            | authenticated, through policies |
| `private.handle_new_user()`                                | Insert a profile during Auth signup                                      | trigger only                    |
| `public.create_group(text,text)`                           | Atomically create a group and its first admin; checks `auth.uid()`       | authenticated RPC               |
| `public.join_group_by_invite(text)`                        | Join before membership exists; verifies identity/code, idempotent insert | authenticated RPC               |
| `public.create_activity_proposal(uuid,text,text)`          | Lock and validate the event and membership before creating a proposal    | authenticated RPC               |
| `public.create_poll(uuid,text,text[],boolean,timestamptz)` | Atomically create validated options for a member and an open event       | authenticated RPC               |
| `public.cast_vote(uuid,uuid[])`                            | Serialize replacement votes and enforce poll and event closure           | authenticated RPC               |
| `public.close_poll(uuid)`                                  | Serialize closure after checking creator or group admin                  | authenticated RPC               |
| `private.enforce_photo_quota()`                            | Lock/increment a group's storage counter, reject over quota              | trigger only                    |
| `private.release_photo_quota()`                            | Decrement storage usage after photo deletion                             | trigger only                    |

Results, balances and settlement suggestions use `SECURITY INVOKER`; they inherit the caller's RLS. Pure timestamp, immutable-field and domain-validation trigger functions also use invoker rights. The private schema is not exposed through PostgREST.

Invite codes currently have no expiration/revocation/redemption history. Those were planned acceptance criteria, not implemented guarantees. Adding them requires new migrations and tests.

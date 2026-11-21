# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Identity Integrity**: Every user document (`users_public/{userId}`, `users_private/{userId}`), membership (`chat_memberships/{membershipId}`), message (`senderId`), reaction (`uid`), and typing status (`uid`) must match `request.auth.uid`.
2. **PII Isolation**: User email addresses and private preferences reside strictly in `users_private/{userId}`, accessible only when `request.auth.uid == userId`. `users_public/{userId}` contains zero PII.
3. **Master Gate**: Access to subcollections (`messages`, `reactions`, `typing`) under `/chats/{chatId}` is derived strictly from the parent `/chats/{chatId}` document (`type == 'public'` or `request.auth.uid in chat.memberIds`).
4. **Bounded Arrays & Strict Keys**: `memberIds` on `chats/{chatId}` is strictly bounded (`1 <= size <= 50`). Every `create` verifies both `hasAll` and `hasOnly`; every `update` runs inside `isValid[Entity](incoming())` and splits into explicit action branches with `affectedKeys().hasOnly(...)`.
5. **Temporal & Immutable Integrity**: Timestamps (`createdAt`, `updatedAt`, `lastSeenAt`, `lastMessageAt`, `lastReadAt`) must equal `request.time`. Immutable IDs (`id`, `uid`, `chatId`, `ownerId`, `senderId`, `createdAt`) cannot be altered after creation.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Spoof**: Write to `users_public/{uid}` with `email_verified: false` -> `PERMISSION_DENIED`.
2. **PII Leak Attempt**: `get` or `list` on `users_private/{otherUid}` as another user -> `PERMISSION_DENIED`.
3. **UID Impersonation**: Create message in `chats/{chatId}/messages/{msgId}` with `senderId: "victimUid"` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Create `PublicUser` with extra ghost key `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Shadow Update Injection**: Update `Chat` title while sneaking `ownerId: request.auth.uid` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Write to `chats/abc$invalid!id/messages/1` -> `PERMISSION_DENIED`.
7. **Denial-of-Wallet Oversized Text**: Send a message with `text` of 10,000 characters (`> 4000`) -> `PERMISSION_DENIED`.
8. **Unbounded Member Array**: Create a group chat with 51 UIDs in `memberIds` (`> 50`) -> `PERMISSION_DENIED`.
9. **Unauthorized Chat Eavesdropping**: `get` or `list` messages in a private DM chat where `request.auth.uid` is not in `memberIds` -> `PERMISSION_DENIED`.
10. **Non-Owner Group Hijack**: Non-owner member attempts to change `title` or `memberIds` of a group chat -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Create message with backdated client timestamp `createdAt != request.time` -> `PERMISSION_DENIED`.
12. **Blanket Query Scraping**: `list` on `chats` without filtering by `type == 'public'` or `memberIds array-contains uid` -> `PERMISSION_DENIED`.

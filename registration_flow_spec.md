# Refactor Task: Move Registration Staging to Redis & Enforce OTP Verification

## Context & Purpose
The registration system already has basic routing, hashing, and database connectivity in place. However, registration currently writes directly to the database or lacks proper temporary caching.

**Goal:** Refactor the existing registration flow so that:
1. `POST /register` does **NOT** create a user in PostgreSQL. Instead, it stages the user data and hashed OTP in Redis and sends the OTP via email.
2. An unverified registration session lives in Redis for **24 hours**.
3. The OTP lives in Redis for **3 minutes**.
4. `POST /resend-otp` is blocked if the 3-minute OTP has not yet expired.
5. Only upon successful `POST /verify-otp` is the user record written to PostgreSQL using Prisma, after which the Redis cache is purged.

---

## 1. Redis Key Schema

Use two separate Redis keys identified by a unique `registrationId` (UUID v4):

| Redis Key | Value | TTL | Description |
| :--- | :--- | :--- | :--- |
| `reg:data:<registrationId>` | `{"name": "...", "email": "...", "passwordHash": "..."}` (JSON string) | **24 hours** (`86400`s) | Pre-hashed user data waiting for verification |
| `reg:otp:<registrationId>` | Hashed OTP string (`bcrypt`) | **3 minutes** (`180`s) | Active OTP for matching |

> **Security Requirements:**
> - Never store the plain password in Redis. Store `passwordHash`.
> - Never store the plain OTP in Redis. Store `otpHash`.

---

## 2. Refactoring Tasks & Endpoint Requirements

### Task 1: Refactor `POST /register`
- **Current Behavior to Remove:** Remove `prisma.user.create()` from this endpoint.
- **New Flow:**
  1. Validate incoming `name`, `email`, and `password`.
  2. Check existing user in PostgreSQL:
     ```typescript
     const existingUser = await prisma.user.findUnique({ where: { email } });
     if (existingUser) return res.status(409).json({ message: 'User already exists' });
     ```
  3. Generate `registrationId = crypto.randomUUID()`.
  4. Hash the password (`bcrypt.hash(password, 10)`).
  5. Generate a 6-digit OTP and hash it (`bcrypt.hash(otp, 10)`).
  6. Store both keys in Redis (using pipeline or multi):
     - `SET reg:data:<registrationId> <jsonUserData> EX 86400`
     - `SET reg:otp:<registrationId> <hashedOtp> EX 180`
  7. Dispatch OTP to the user's email via the existing email transport.
  8. **Response (200 OK):**
     ```json
     {
       "success": true,
       "message": "OTP sent to your email. Please verify to complete registration.",
       "registrationId": "<uuid>",
       "expiresIn": 180
     }
     ```

---

### Task 2: Refactor / Implement `POST /verify-otp`
- **Request Body:**
  ```json
  {
    "registrationId": "<uuid>",
    "otp": "123456"
  }
  ```
- **Execution Flow:**
  1. Fetch `reg:data:<registrationId>` from Redis.
     - If not found: return `400 Bad Request` (`"Registration session expired or invalid. Please sign up again."`).
  2. Fetch `reg:otp:<registrationId>` from Redis.
     - If not found: return `400 Bad Request` (`"OTP has expired. Please request a new one."`).
  3. Compare incoming plain `otp` with hashed OTP in Redis (`bcrypt.compare(otp, storedOtpHash)`).
     - If mismatch: return `400 Bad Request` (`"Invalid OTP"`).
  4. Parse user payload from `reg:data:<registrationId>`.
  5. Check once more for email duplication in Prisma (to avoid race conditions).
  6. **Create User in PostgreSQL:**
     ```typescript
     const newUser = await prisma.user.create({
       data: {
         name: userData.name,
         email: userData.email,
         password: userData.passwordHash,
       },
     });
     ```
  7. **Clean up Redis:** Delete both keys:
     ```typescript
     await redis.del(`reg:data:${registrationId}`, `reg:otp:${registrationId}`);
     ```
  8. Issue JWT Access & Refresh tokens.
  9. **Response (201 Created):**
     ```json
     {
       "success": true,
       "message": "Registration completed successfully.",
       "user": {
         "id": newUser.id,
         "name": newUser.name,
         "email": newUser.email
       },
       "accessToken": "<token>",
       "refreshToken": "<token>"
     }
     ```

---

### Task 3: Refactor / Implement `POST /resend-otp`
- **Request Body:**
  ```json
  {
    "registrationId": "<uuid>"
  }
  ```
- **Execution Flow:**
  1. Check if registration session still exists:
     ```typescript
     const rawUserData = await redis.get(`reg:data:${registrationId}`);
     if (!rawUserData) {
       return res.status(400).json({ message: "Registration session expired. Please register again." });
     }
     ```
  2. Check remaining TTL on the active OTP key:
     ```typescript
     const ttlRemaining = await redis.ttl(`reg:otp:${registrationId}`);
     if (ttlRemaining > 0) {
       return res.status(429).json({
         message: `Please wait ${ttlRemaining} seconds before requesting a new OTP.`,
         retryAfter: ttlRemaining
       });
     }
     ```
  3. If expired (or key does not exist):
     - Generate a new 6-digit OTP.
     - Hash the new OTP.
     - Save to Redis: `SET reg:otp:<registrationId> <newHashedOtp> EX 180`.
     - Send the new OTP to `userData.email`.
  4. **Response (200 OK):**
     ```json
     {
       "success": true,
       "message": "New OTP sent to email.",
       "expiresIn": 180
     }
     ```

---

## 3. Checklist for Agent Implementation
- [ ] Ensure `ioredis` (or preferred Redis client instance) is imported into the auth service/controller.
- [ ] Confirm no `prisma.user.create()` call runs in the initial register route.
- [ ] Ensure `passwordHash` and `otpHash` are used when saving to Redis.
- [ ] Verify `reg:data:<id>` TTL is set to 24 hours (`86400`) and `reg:otp:<id>` TTL is set to 3 minutes (`180`).
- [ ] Confirm `redis.del()` deletes both keys immediately after successful user creation.
- [ ] Confirm `POST /resend-otp` rejects calls with HTTP 429 when `redis.ttl('reg:otp:<id>') > 0`.